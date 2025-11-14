import type { CallWorkflowInput, CallWorkflowResult } from "@/application/dto/call-workflow.dto";
import type { AddressResolverPort, ResolvedSearchFlags } from "@/application/ports/address-resolver.port";
import { CallExternalWorkflow } from "@/application/workflows/call-external.workflow";
import { ListingIdExtractorService } from "@/application/services/listing-id-extractor.service";
import type { PdpDerivedData } from "@/application/dto/pdp.dto";
import { Result, Option } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";

export interface GetPdpFromAddressConfig {
  airbnbSearchUrl: string;
  airbnbUrl: string;
  airbnbSearchBody: unknown;
  apiKey: string;
  defaultTimeoutMs?: number;
}

export interface GetPdpFromAddressInput {
  address: string;
  timeoutMs?: number;
}

export class GetPdpFromAddressWorkflow {
  private readonly listingIdExtractor: ListingIdExtractorService;

  constructor(
    private readonly callWorkflow: CallExternalWorkflow,
    private readonly addressResolver: AddressResolverPort,
    private readonly config: GetPdpFromAddressConfig
  ) {
    this.listingIdExtractor = new ListingIdExtractorService();
  }

  private buildStaysInput(flags: ResolvedSearchFlags, timeoutMs?: number): CallWorkflowInput {
    return {
      url: this.config.airbnbSearchUrl,
      method: "POST",
      headers: [
        { name: "x-airbnb-api-key", value: this.config.apiKey },
        { name: "content-type", value: "application/json" },
      ],
      body: this.config.airbnbSearchBody,
      flags: {
        bbox: flags.bbox,
        zoomLevel: flags.zoomLevel,
        queryAddress: flags.queryAddress,
        refinementPath: flags.refinementPath,
        searchByMap: flags.searchByMap,
        poiPlace: flags.poiPlace,
        poiAcp: flags.poiAcp,
      },
      timeoutMs: timeoutMs ?? this.config.defaultTimeoutMs,
    };
  }

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

  private listingIdOptToResult(opt: Option<string>): Result<string, AppError> {
    if (opt.isNone()) {
      return Result.Err({
        kind: "InvalidResponseError",
        message: "No listingId found in staysInViewport",
      } as AppError);
    }
    return Result.Ok(opt.unwrap());
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
        const resolveResult = await Promise.resolve(this.addressResolver.resolve(addr));
        return resolveResult;
      })
      .flatMap((flags: ResolvedSearchFlags) => {
        const staysInput = this.buildStaysInput(flags, timeoutMs);
        return this.callWorkflow.execute<unknown>(staysInput);
      })
      .flatMap((stays: CallWorkflowResult<unknown>) => {
        const listingIdOpt = this.listingIdExtractor.extractFirstListingId(stays.response.data);
        return this.listingIdOptToResult(listingIdOpt);
      })
      .flatMap((listingId: string) => {
        const pdpInput = this.buildPdpInput(listingId, timeoutMs);
        return this.callWorkflow.execute<unknown>(pdpInput);
      })
      .map((pdp: CallWorkflowResult<unknown>): PdpDerivedData => {
        const htmlTexts = pdp.derived?.htmlTexts ?? [];
        const pdpItems = pdp.derived?.pdpItems ?? [];
        return { htmlTexts, pdpItems };
      })
      .toPromise();
  }
}

