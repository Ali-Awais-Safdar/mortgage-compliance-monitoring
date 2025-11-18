import type { CallWorkflowResult } from "@/application/dto/call-workflow.dto";
import type { AddressResolverPort } from "@/application/ports/address-resolver.port";
import type { ShortTermRentalProviderPort } from "@/application/ports/short-term-rental.port";
import { CallExternalWorkflow } from "@/application/workflows/call-external.workflow";
import type { PdpDerivedData } from "@/domain/value-objects/pdp-derived.vo";
import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";
import { buildPdpInput } from "@/application/services/pdp-input.builder";
import { aggregateErrorsToInvalidResponse } from "@/application/utils/app-error.helpers";

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

  async execute(input: GetPdpFromAddressInput): Promise<Result<PdpDerivedData[], AppError>> {
    const address = input.address; // already validated by HTTP boundary
    const timeoutMs = input.timeoutMs ?? this.config.defaultTimeoutMs;

    // Resolve address to search flags
    const resolveResult = await Promise.resolve(this.addressResolver.resolve(address));
    
    return resolveResult
      .flatMap(async (flags) => {
        // Find all listing IDs via short-term rental provider
        const listingIdsResult = await this.shortTermProvider.findListingIds(flags, timeoutMs);
        return listingIdsResult;
      })
      .flatMap(async (listingIds: string[]) => {
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

