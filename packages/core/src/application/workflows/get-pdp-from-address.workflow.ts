import type { PdpDerivedData } from "@/domain/value-objects/pdp-derived.vo";
import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";
import { DeterministicViewportSearchService } from "@/application/services/deterministic-viewport-search.service";
import { PdpBatchFetchService } from "@/application/services/pdp-batch-fetch.service";

export interface GetPdpFromAddressConfig {
  defaultTimeoutMs?: number;
}

export interface GetPdpFromAddressInput {
  address: string;
  timeoutMs?: number;
}

export class GetPdpFromAddressWorkflow {
  constructor(
    private readonly viewportSearch: DeterministicViewportSearchService,
    private readonly pdpBatch: PdpBatchFetchService,
    private readonly config: GetPdpFromAddressConfig
  ) {}

  async execute(input: GetPdpFromAddressInput): Promise<Result<PdpDerivedData[], AppError>> {
    const address = input.address; // already validated by HTTP boundary
    const timeoutMs = input.timeoutMs ?? this.config.defaultTimeoutMs;

    // Find listings using deterministic viewport search service
    const listingsRes = await this.viewportSearch.findListingsFromAddress(address, timeoutMs);
    
    // Log viewport metadata for visibility into which strategy was used
    if (listingsRes.isOk()) {
      const { viewportMeta } = listingsRes.unwrap();
      console.log("[Viewport] strategy used", {
        address,
        strategy: viewportMeta.strategy,
        widthMeters: viewportMeta.widthMeters,
        heightMeters: viewportMeta.heightMeters,
        safetyMeters: viewportMeta.safetyMeters,
      });
    }
    
    return listingsRes
      .flatMap(({ listingIds }) =>
        this.pdpBatch.fetchDerivedForListingIds(listingIds, timeoutMs)
      )
      .toPromise();
  }
}

