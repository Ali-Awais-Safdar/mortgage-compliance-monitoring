import type { PropertyJsonFetchPort } from "@/application/ports/property-content.port";
import { RedfinUrlFinderService } from "@/application/services/redfin-url-finder.service";
import { RedfinPropertyExtractor } from "@/domain/services/redfin-property-extractor.service";
import { MatchCalculator } from "@/domain/services/match-calculator.service";
import { AirbnbPdpExtractor } from "@/domain/services/airbnb-pdp-extractor.service";
import { PdpJsonSerializer } from "@/application/services/pdp-json-serializer.service";
import { ResponsePostprocessService } from "@/domain/services/response-postprocess.service";
import { PdpBatchFetchService } from "@/application/services/pdp-batch-fetch.service";
import type { CompareResponseDTO, CompareListingDetailDTO } from "@/application/dto/compare.dto";
import type { PdpListingDetailsDTO } from "@/application/dto/pdp.dto";
import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";
import { DeterministicViewportSearchService } from "@/application/services/deterministic-viewport-search.service";
import type { BoundingBox } from "@/domain/value-objects/bounding-box.vo";
import type { PropertyDetails } from "@/domain/value-objects/property-details.vo";

export interface CompareListingsByAddressInput {
  address: string;
  timeoutMs?: number;
}

export type CompareDebugEvent =
  | {
      type: "viewport-resolved";
      payload: {
        address: string;
        bbox: BoundingBox;
        listingIds: string[];
        strategy: string;
      };
    }
  | {
      type: "pdp-derived";
      payload: {
        address: string;
        listingCount: number;
      };
    }
  | {
      type: "airbnb-listings";
      payload: {
        address: string;
        listings: Array<{
          bedrooms?: number;
          baths?: number;
        }>;
      };
    }
  | {
      type: "redfin-url";
      payload: {
        address: string;
        redfinUrl: string | null;
      };
    }
  | {
      type: "property-details";
      payload: {
        address: string;
        propertyDetails: PropertyDetails;
      };
    }
  | {
      type: "final-match";
      payload: {
        address: string;
        listings: number;
        bestMatch?: number;
      };
    };

export interface CompareListingsByAddressConfig {
  defaultTimeoutMs?: number;
  debugLog?: (event: CompareDebugEvent) => void;
}

export class CompareListingsByAddressWorkflow {
  constructor(
    private readonly viewportSearch: DeterministicViewportSearchService,
    private readonly pdpBatch: PdpBatchFetchService,
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

        if (listingsRes.isOk()) {
          const { viewportMeta, listingIds, bbox } = listingsRes.unwrap();

          this.config.debugLog?.({
            type: "viewport-resolved",
            payload: {
              address,
              bbox,
              listingIds,
              strategy: viewportMeta.strategy,
            },
          });
        }

        return listingsRes.map(({ listingIds, bbox }) => ({ listingIds, bbox, address }));
      })
      .flatMap(async ({ listingIds, bbox, address }) => {
        // Fetch PDP data using batch service with retry and concurrency control
        const derivedRes = await this.pdpBatch.fetchDerivedForListingIds(listingIds, timeoutMs);
        return derivedRes.map((derivedList) => {
          this.config.debugLog?.({
            type: "pdp-derived",
            payload: {
              address,
              listingCount: derivedList.length,
            },
          });

          const listings = derivedList.map((derived) => {
            const listing = this.serializer.serialize(derived, this.postprocess);
            const numeric = this.pdpExtractor.extract(derived);
            return {
              listing,
              numeric: { bedrooms: numeric.bedrooms, baths: numeric.baths },
            };
          });

          this.config.debugLog?.({
            type: "airbnb-listings",
            payload: {
              address,
              listings: listings.map(({ numeric }) => numeric),
            },
          });
          return { listings, bbox, address };
        });
      })
      .flatMap(async ({ listings, bbox, address }) => {
        // Fetch Redfin data
        const urlResult = await this.redfinFinder.findRedfinUrlForAddress(address, 10, timeoutMs);
        return urlResult.flatMap(async (redfinUrl: string) => {
          this.config.debugLog?.({
            type: "redfin-url",
            payload: {
              address,
              redfinUrl,
            },
          });

          const jsonResult = await this.propertyContent.fetchJson(redfinUrl, timeoutMs);
          return jsonResult.map((redfinJson: unknown) => ({
            listings,
            bbox,
            redfinJson,
            address,
          }));
        });
      })
      .flatMap(async ({ listings, bbox, redfinJson, address }: { listings: Array<{ listing: PdpListingDetailsDTO; numeric: { bedrooms?: number; baths?: number } }>; bbox: BoundingBox; redfinJson: unknown; address: string }) => {
        // Extract Redfin property details
        const propertyDetails = this.redfinExtractor.extract(redfinJson);

        this.config.debugLog?.({
          type: "property-details",
          payload: {
            address,
            propertyDetails,
          },
        });

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

        const bestMatch = listingDetails.reduce(
          (acc, listing) => (listing.matchPercentage > acc ? listing.matchPercentage : acc),
          0
        );

        this.config.debugLog?.({
          type: "final-match",
          payload: {
            address,
            listings: listingDetails.length,
            bestMatch,
          },
        });

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

