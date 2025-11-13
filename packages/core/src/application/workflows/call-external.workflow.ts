import type { CallWorkflowInput, CallWorkflowResult } from "@/application/dto/call-workflow.dto";
import type { ApiRequestDTO, ApiResponseDTO } from "@/application/dto/request.dto";
import type { HttpPort } from "@/application/ports/http.port";
import { BodyPatchService } from "@/application/services/body-patch.service";
import { ResponsePostprocessService } from "@/application/services/response-postprocess.service";
import { UrlPatchService } from "@/application/services/url-patch.service";
import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";
import { guardBBoxString, guardListingId, guardOverrides } from "@/application/services/validation.service";

export class CallExternalWorkflow {
  constructor(
    private readonly http: HttpPort,
    private readonly urlPatcher: UrlPatchService,
    private readonly bodyPatcher: BodyPatchService,
    private readonly postprocess: ResponsePostprocessService
  ) {}

  async execute<T = unknown>(input: CallWorkflowInput): Promise<Result<CallWorkflowResult<T>, AppError>> {
    const pre = await Result.Ok(true)
      .validate([
        () => guardBBoxString(input.flags?.bbox),
        () => guardOverrides(input.overrides),
        () => guardListingId(input.flags?.listingId),
      ])
      .mapErr((errs: AppError | AppError[]) => {
        const fallback = "Invalid input";
        if (Array.isArray(errs)) {
          return errs
            .map((e) => e.message ?? fallback)
            .join("; ");
        }
        return errs.message ?? fallback;
      })
      .mapErr((message) => ({ kind: "InvalidInputError", message } as AppError))
      .toPromise();

    if (pre.isErr()) {
      return Result.Err(pre.unwrapErr());
    }

    const url = new URL(input.url);

    const listingId = input.flags?.listingId;
    if (listingId) {
      this.urlPatcher.applyListingId(url, listingId);
    }

    const finalBody = input.body !== undefined
      ? this.bodyPatcher.prepareBody(input.body, input.flags, input.overrides ?? [])
      : undefined;

    const request: ApiRequestDTO = {
      url: url.toString(),
      method: input.method,
      headers: input.headers,
      query: input.query,
      body: finalBody,
      timeoutMs: input.timeoutMs,
    };

    const response = await this.http.request<T>(request);

    type DerivedData = {
      htmlTexts: string[];
      pdpItems: Array<{ title?: string; action?: unknown }>;
    };

    const enriched = response
      .zip((res: ApiResponseDTO<T>) => (res.data != null ? this.postprocess.extractDerived(res.data as T) : undefined))
      .map(([res, derived]: [ApiResponseDTO<T>, DerivedData | undefined]) => (derived ? { response: res, derived } : { response: res }));

    return enriched.toPromise();
  }
}
