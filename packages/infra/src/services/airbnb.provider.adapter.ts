import { Result } from "@carbonteq/fp";
import type {
  ShortTermRentalProviderPort,
  RentalPropertyDetails,
  ResolvedSearchFlags,
  AppError,
} from "@poc/core";
import type { CallExternalWorkflow } from "@poc/core";
import {
  ListingIdExtractorService,
  AirbnbPdpExtractor,
} from "@poc/core";

export interface AirbnbProviderAdapterConfig {
  airbnbSearchUrl: string;
  airbnbUrl: string;
  airbnbSearchBody: unknown;
  apiKey: string;
  defaultTimeoutMs?: number;
}

export class AirbnbProviderAdapter implements ShortTermRentalProviderPort {
  private readonly listingIdExtractor = new ListingIdExtractorService();
  private readonly pdpExtractor = new AirbnbPdpExtractor();

  constructor(
    private readonly callWorkflow: CallExternalWorkflow,
    private readonly config: AirbnbProviderAdapterConfig
  ) {}

  async findListingId(flags: ResolvedSearchFlags, timeoutMs?: number): Promise<Result<string, AppError>> {
    const input = {
      url: this.config.airbnbSearchUrl,
      method: "POST" as const,
      headers: [
        { name: "x-airbnb-api-key", value: this.config.apiKey },
        { name: "content-type", value: "application/json" },
      ],
      body: this.config.airbnbSearchBody,
      flags,
      timeoutMs: timeoutMs ?? this.config.defaultTimeoutMs,
    };

    const res = await this.callWorkflow.execute<unknown>(input);
    return res
      .map((wf) => this.listingIdExtractor.extractFirstListingId(wf.response.data))
      .flatMap((opt) =>
        opt.isSome()
          ? Result.Ok(opt.unwrap())
          : Result.Err({ kind: "InvalidResponseError", message: "No listingId found" } as AppError)
      );
  }

  async getDetails(listingId: string, timeoutMs?: number): Promise<Result<RentalPropertyDetails, AppError>> {
    const input = {
      url: this.config.airbnbUrl,
      method: "GET" as const,
      headers: [{ name: "x-airbnb-api-key", value: this.config.apiKey }],
      flags: { listingId },
      timeoutMs: timeoutMs ?? this.config.defaultTimeoutMs,
    };

    const res = await this.callWorkflow.execute<unknown>(input);
    return res.map((wf) => {
      const derived = wf.derived ?? { htmlTexts: [], pdpItems: [] };
      const extracted = this.pdpExtractor.extract({
        htmlTexts: derived.htmlTexts ?? [],
        pdpItems: derived.pdpItems ?? [],
        listingId,
      });

      return {
        listingId,
        url: `https://www.airbnb.com/rooms/${listingId}`,
        bedrooms: extracted.bedrooms,
        baths: extracted.baths,
      } satisfies RentalPropertyDetails;
    });
  }
}

