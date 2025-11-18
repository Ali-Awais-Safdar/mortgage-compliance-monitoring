import type { AddressResolverPort, ResolvedSearchFlags } from "@/application/ports/address-resolver.port";
import type { ShortTermRentalProviderPort } from "@/application/ports/short-term-rental.port";
import type { PropertyJsonFetchPort } from "@/application/ports/property-content.port";
import { RedfinUrlFinderService } from "@/application/services/redfin-url-finder.service";
import { RedfinPropertyExtractor } from "@/application/services/redfin-property-extractor.service";
import { MatchCalculator } from "@/application/services/match-calculator.service";
import { AirbnbPdpExtractor } from "@/application/services/airbnb-pdp-extractor.service";
import { PdpJsonSerializer } from "@/application/services/pdp-json-serializer.service";
import { ResponsePostprocessService } from "@/application/services/response-postprocess.service";
import { CallExternalWorkflow } from "@/application/workflows/call-external.workflow";
import type { CallWorkflowInput } from "@/application/dto/call-workflow.dto";
import type { CompareResponseDTO, CompareListingDetailDTO } from "@/application/dto/compare.dto";
import type { PdpDerivedData, PdpListingDetailsDTO } from "@/application/dto/pdp.dto";
import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";

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
    private readonly addressResolver: AddressResolverPort,
    private readonly shortTermProvider: ShortTermRentalProviderPort,
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
        // Resolve address to search flags (capture bbox for later)
        const resolveResult = await Promise.resolve(this.addressResolver.resolve(addr));
        return resolveResult;
      })
      .flatMap(async (flags) => {
        // Find all listing IDs via short-term rental provider
        const listingIdsResult = await this.shortTermProvider.findListingIds(flags, timeoutMs);
        return listingIdsResult.map((listingIds) => ({ listingIds, flags }));
      })
      .flatMap(async ({ listingIds, flags }) => {
        // Fetch PDP data for all listing IDs in parallel
        const pdpPromises = listingIds.map(async (listingId: string) => {
          const pdpInput = this.buildPdpInput(listingId, timeoutMs);
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

        return aggregated.mapErr((errs: AppError | AppError[]) => {
          const errorMessages = (Array.isArray(errs) ? errs : [errs])
            .map((e) => e.message ?? "Unknown error")
            .join("; ");
          return {
            kind: "InvalidResponseError",
            message: errorMessages,
          } as AppError;
        }).map((listings: Array<{ listing: PdpListingDetailsDTO; numeric: { bedrooms?: number; baths?: number } }>) => ({ listings, flags }));
      })
      .flatMap(async ({ listings, flags }) => {
        // Fetch Redfin data
        const urlResult = await this.redfinFinder.findRedfinUrlForAddress(address, 10, timeoutMs);
        return urlResult.flatMap(async (redfinUrl: string) => {
          const jsonResult = await this.propertyContent.fetchJson(redfinUrl, timeoutMs);
          return jsonResult.map((redfinJson: unknown) => ({
            listings,
            flags,
            redfinJson,
          }));
        });
      })
      .flatMap(async ({ listings, flags, redfinJson }: { listings: Array<{ listing: PdpListingDetailsDTO; numeric: { bedrooms?: number; baths?: number } }>; flags: ResolvedSearchFlags; redfinJson: unknown }) => {
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

        // Parse bbox string to tuple [neLat, neLng, swLat, swLng]
        const bbox = this.parseBbox(flags.bbox);
        if (!bbox) {
          return Result.Err({
            kind: "InvalidInputError",
            message: "Invalid bbox format",
          } as AppError);
        }

        return Result.Ok({
          propertyDetails,
          bbox,
          confidenceScore,
          listingDetails,
        } as CompareResponseDTO);
      })
      .toPromise();
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

  private parseBbox(bboxString: string): [number, number, number, number] | null {
    try {
      const parts = bboxString.split(",").map((s) => s.trim());
      if (parts.length !== 4) {
        return null;
      }

      const numbers = parts.map((s) => Number.parseFloat(s));
      if (numbers.some((n) => Number.isNaN(n))) {
        return null;
      }

      return [numbers[0], numbers[1], numbers[2], numbers[3]] as [number, number, number, number];
    } catch {
      return null;
    }
  }
}

