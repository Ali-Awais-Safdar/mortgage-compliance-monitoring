import { Result } from "@carbonteq/fp";
import type {
  ShortTermRentalProviderPort,
  ResolvedSearchFlags,
  AppError,
} from "@poc/core";
import type { CallExternalWorkflow } from "@poc/core";
import { ListingIdExtractorService } from "@poc/core";

export interface AirbnbProviderAdapterConfig {
  airbnbSearchUrl: string;
  airbnbUrl: string;
  airbnbSearchBody: unknown;
  apiKey: string;
  defaultTimeoutMs?: number;
}

export class AirbnbProviderAdapter implements ShortTermRentalProviderPort {
  private readonly listingIdExtractor = new ListingIdExtractorService();

  constructor(
    private readonly callWorkflow: CallExternalWorkflow,
    private readonly config: AirbnbProviderAdapterConfig
  ) {}

  async findListingIds(flags: ResolvedSearchFlags, timeoutMs?: number): Promise<Result<string[], AppError>> {
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
    
    if (res.isErr()) {
      const err = res.unwrapErr();
      console.error("[Airbnb findListingIds] error", { kind: err.kind, message: err.message });
      return res;
    }

    return res
      .map((wf) => this.listingIdExtractor.extractListingIds(wf.response.data))
      .map((opt) => (opt.isSome() ? opt.unwrap() : []));
  }
}

