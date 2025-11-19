import type { PropertyJsonFetchPort } from "@/application/ports/property-content.port";
import { RedfinUrlFinderService } from "@/application/services/redfin-url-finder.service";
import { RedfinPropertyExtractor } from "@/domain/services/redfin-property-extractor.service";
import { MatchCalculator } from "@/domain/services/match-calculator.service";
import { AirbnbPdpExtractor } from "@/domain/services/airbnb-pdp-extractor.service";
import { PdpJsonSerializer } from "@/application/services/pdp-json-serializer.service";
import { ResponsePostprocessService } from "@/domain/services/response-postprocess.service";
import { CallExternalWorkflow } from "@/application/workflows/call-external.workflow";
import { buildPdpInput } from "@/application/services/pdp-input.builder";
import type { CompareResponseDTO, CompareListingDetailDTO } from "@/application/dto/compare.dto";
import type { PdpListingDetailsDTO } from "@/application/dto/pdp.dto";
import type { PdpDerivedData } from "@/domain/value-objects/pdp-derived.vo";
import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";
import { aggregateErrorsToInvalidResponse } from "@/application/utils/app-error.helpers";
import { DeterministicViewportSearchService } from "@/application/services/deterministic-viewport-search.service";
import type { BoundingBox } from "@/domain/value-objects/bounding-box.vo";

export interface CompareListingsByAddressInput {
  address: string;
  timeoutMs?: number;
}

export interface CompareListingsByAddressConfig {
  airbnbUrl: string;
  apiKey: string;
  defaultTimeoutMs?: number;
}

export class CompareListingsByAddressWorkflow {
  constructor(
    private readonly viewportSearch: DeterministicViewportSearchService,
    private readonly callWorkflow: CallExternalWorkflow,
    private readonly serializer: PdpJsonSerializer,
    private readonly postprocess: ResponsePostprocessService,
    private readonly config: CompareListingsByAddressConfig,
    private readonly pdpExtractor: AirbnbPdpExtractor,
    private readonly redfinFinder: RedfinUrlFinderService,
    private readonly propertyContent: PropertyJsonFetchPort,
    private readonly redfinExtractor: RedfinPropertyExtractor,
    private readonly matcher: MatchCalculator
  ) {}

  async execute(
    input: CompareListingsByAddressInput
  ): Promise<Result<CompareResponseDTO, AppError>> {
    const address = input.address;
    const timeoutMs = input.timeoutMs ?? this.config.defaultTimeoutMs;

    return Result.Ok({ address })
      .flatMap(async ({ address }) => {
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
        
        return listingsRes.map(({ listingIds, bbox }) => ({ listingIds, bbox, address }));
      })
      .flatMap(async ({ listingIds, bbox, address }) => {
        // Fetch PDP data for all listing IDs in parallel
        const pdpPromises = listingIds.map(async (listingId: string) => {
          const pdpInput = buildPdpInput(this.config, listingId, timeoutMs);
          const pdpResult = await this.callWorkflow.execute<unknown>(pdpInput);
          return pdpResult.map((result) => {
            const derived: PdpDerivedData = {
              htmlTexts: result.derived?.htmlTexts,
              pdpItems: result.derived?.pdpItems,
              lat: result.derived?.lat,
              lng: result.derived?.lng,
            };
            const listing = this.serializer.serialize(derived, this.postprocess);
            const numeric = this.pdpExtractor.extract(derived);
            return {
              listing,
              numeric: { bedrooms: numeric.bedrooms, baths: numeric.baths },
            };
          });
        });

        const pdpResults = await Promise.all(pdpPromises);
        const aggregated = Result.all(...pdpResults);

        return aggregated
          .mapErr(aggregateErrorsToInvalidResponse)
          .map((listings: Array<{ listing: PdpListingDetailsDTO; numeric: { bedrooms?: number; baths?: number } }>) => ({ listings, bbox, address }));
      })
      .flatMap(async ({ listings, bbox, address }) => {
        // Fetch Redfin data
        const urlResult = await this.redfinFinder.findRedfinUrlForAddress(address, 10, timeoutMs);
        return urlResult.flatMap(async (redfinUrl: string) => {
          const jsonResult = await this.propertyContent.fetchJson(redfinUrl, timeoutMs);
          return jsonResult.map((redfinJson: unknown) => ({
            listings,
            bbox,
            redfinJson,
          }));
        });
      })
      .flatMap(async ({ listings, bbox, redfinJson }: { listings: Array<{ listing: PdpListingDetailsDTO; numeric: { bedrooms?: number; baths?: number } }>; bbox: BoundingBox; redfinJson: unknown }) => {
        // Extract Redfin property details
        const propertyDetails = this.redfinExtractor.extract(redfinJson);

        // Compute matchPercentage for each listing and build listingDetails
        const listingDetails: CompareListingDetailDTO[] = [];

        for (const { listing, numeric } of listings) {
          const matchResult = this.matcher.calcMatch(
            numeric.bedrooms,
            propertyDetails.bedrooms,
            numeric.baths,
            propertyDetails.baths
          );

          // Include listing even if no match (matchPercentage will be 0)
          listingDetails.push({
            ...listing,
            matchPercentage: matchResult.percentage,
          });
        }

        // Fail if no listingDetails
        if (listingDetails.length === 0) {
          return Result.Err({
            kind: "InvalidResponseError",
            message: "No listing details found",
          } as AppError);
        }

        // Compute confidenceScore (average of matchPercentages, rounded)
        const totalMatchPercentage = listingDetails.reduce((sum, listing) => sum + listing.matchPercentage, 0);
        const averageMatchPercentage = totalMatchPercentage / listingDetails.length;
        const confidenceScore = {
          score: Math.round(averageMatchPercentage),
          scale: "0-100" as const,
          basis: ["listingDetails.matchPercentage"],
        };

        return Result.Ok({
          propertyDetails,
          bbox,
          confidenceScore,
          listingDetails,
        } as CompareResponseDTO);
      })
      .toPromise();
  }
}

