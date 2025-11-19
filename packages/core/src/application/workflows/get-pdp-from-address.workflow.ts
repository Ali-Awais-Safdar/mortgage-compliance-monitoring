import type { CallWorkflowResult } from "@/application/dto/call-workflow.dto";
import { CallExternalWorkflow } from "@/application/workflows/call-external.workflow";
import type { PdpDerivedData } from "@/domain/value-objects/pdp-derived.vo";
import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";
import { buildPdpInput } from "@/application/services/pdp-input.builder";
import { aggregateErrorsToInvalidResponse } from "@/application/utils/app-error.helpers";
import { DeterministicViewportSearchService } from "@/application/services/deterministic-viewport-search.service";

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
    private readonly viewportSearch: DeterministicViewportSearchService,
    private readonly callWorkflow: CallExternalWorkflow,
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
      .flatMap(async ({ listingIds }) => {
        // Fetch PDP data for all listing IDs in parallel
        const pdpPromises = listingIds.map(async (listingId: string) => {
          const pdpInput = buildPdpInput(this.config, listingId, timeoutMs);
          const pdpResult = await this.callWorkflow.execute<unknown>(pdpInput);
          return pdpResult.map((pdp: CallWorkflowResult<unknown>): PdpDerivedData => {
            const htmlTexts = pdp.derived?.htmlTexts ?? [];
            const pdpItems = pdp.derived?.pdpItems ?? [];
            return { htmlTexts, pdpItems, listingId };
          });
        });

        // Wait for all PDP requests to complete, then aggregate with Result.all
        const pdpResults = await Promise.all(pdpPromises);

        const aggregated = Result.all(...pdpResults);

        return aggregated.mapErr(aggregateErrorsToInvalidResponse);
      })
      .toPromise();
  }
}

