import type { CallWorkflowInput, CallWorkflowResult } from "@/application/dto/call-workflow.dto";
import type { AddressResolverPort } from "@/application/ports/address-resolver.port";
import type { ShortTermRentalProviderPort } from "@/application/ports/short-term-rental.port";
import { CallExternalWorkflow } from "@/application/workflows/call-external.workflow";
import type { PdpDerivedData } from "@/application/dto/pdp.dto";
import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";

export interface GetPdpFromAddressConfig {
  airbnbUrl: string;
  apiKey: string;
  defaultTimeoutMs?: number;
}

export interface GetPdpFromAddressInput {
  address: string;
  timeoutMs?: number;
}

export class GetPdpFromAddressWorkflow {
  constructor(
    private readonly addressResolver: AddressResolverPort,
    private readonly shortTermProvider: ShortTermRentalProviderPort,
    private readonly callWorkflow: CallExternalWorkflow,
    private readonly config: GetPdpFromAddressConfig
  ) {}

  private buildPdpInput(listingId: string, timeoutMs?: number): CallWorkflowInput {
    return {
      url: this.config.airbnbUrl,
      method: "GET",
      headers: [{ name: "x-airbnb-api-key", value: this.config.apiKey }],
      flags: {
        listingId,
      },
      timeoutMs: timeoutMs ?? this.config.defaultTimeoutMs,
    };
  }

  async execute(input: GetPdpFromAddressInput): Promise<Result<PdpDerivedData, AppError>> {
    const address = input.address.trim();
    const timeoutMs = input.timeoutMs ?? this.config.defaultTimeoutMs;

    return Result.Ok(address)
      .validate([
        (addr: string) => {
          if (!addr || addr.length === 0) {
            return Result.Err({
              kind: "InvalidInputError",
              message: "Address cannot be empty",
            } as AppError);
          }
          return Result.Ok(addr);
        },
      ])
      .mapErr((errs: AppError | AppError[]) => {
        const fallback = "Invalid address";
        if (Array.isArray(errs)) {
          return errs
            .map((e) => e.message ?? fallback)
            .join("; ");
        }
        return errs.message ?? fallback;
      })
      .mapErr((message) => ({ kind: "InvalidInputError", message } as AppError))
      .flatMap(async (addr: string) => {
        // Resolve address to search flags
        const resolveResult = await Promise.resolve(this.addressResolver.resolve(addr));
        return resolveResult;
      })
      .flatMap(async (flags) => {
        // Find listing ID via short-term rental provider
        const listingIdResult = await this.shortTermProvider.findListingId(flags, timeoutMs);
        return listingIdResult;
      })
      .flatMap(async (listingId: string) => {
        // Get PDP data using CallExternalWorkflow directly to access derived data
        const pdpInput = this.buildPdpInput(listingId, timeoutMs);
        const pdpResult = await this.callWorkflow.execute<unknown>(pdpInput);
        return pdpResult.map((pdp: CallWorkflowResult<unknown>) => ({ listingId, pdp }));
      })
      .map(({ listingId, pdp }: { listingId: string; pdp: CallWorkflowResult<unknown> }): PdpDerivedData => {
        const htmlTexts = pdp.derived?.htmlTexts ?? [];
        const pdpItems = pdp.derived?.pdpItems ?? [];
        return { htmlTexts, pdpItems, listingId };
      })
      .toPromise();
  }
}

