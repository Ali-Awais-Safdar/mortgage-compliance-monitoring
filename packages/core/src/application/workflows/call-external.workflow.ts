import type { CallWorkflowInput, CallWorkflowResult } from "../dto/call-workflow.dto";
import type { ApiRequestDTO } from "../dto/request.dto";
import type { HttpPort } from "../ports/http.port";
import { BodyPatchService } from "../services/body-patch.service";
import { ResponsePostprocessService } from "../services/response-postprocess.service";
import { UrlPatchService } from "../services/url-patch.service";
import { Result } from "@carbonteq/fp";
import { toAppError, type AppError } from "../errors/app-error";

export class CallExternalWorkflow {
  constructor(
    private readonly http: HttpPort,
    private readonly urlPatcher: UrlPatchService,
    private readonly bodyPatcher: BodyPatchService,
    private readonly postprocess: ResponsePostprocessService
  ) {}

  async execute<T = unknown>(input: CallWorkflowInput): Promise<Result<CallWorkflowResult<T>, AppError>> {
    try {
      const url = new URL(input.url);
      if (input.query) {
        for (const [key, value] of Object.entries(input.query)) {
          url.searchParams.set(key, String(value));
        }
      }

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
        body: finalBody,
        timeoutMs: input.timeoutMs,
      };

      const response = await this.http.request<T>(request);

      const derived = response.data != null ? this.postprocess.extractDerived(response.data as T) : undefined;

      return Result.Ok(derived ? { response, derived } : { response });
    } catch (e) {
      return Result.Err(toAppError(e, { timeoutMs: input.timeoutMs }));
    }
  }
}
