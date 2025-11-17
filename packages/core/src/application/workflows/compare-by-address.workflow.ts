import type { AddressResolverPort } from "@/application/ports/address-resolver.port";
import type { ShortTermRentalProviderPort, RentalPropertyDetails } from "@/application/ports/short-term-rental.port";
import type { PropertyJsonFetchPort } from "@/application/ports/property-content.port";
import { RedfinUrlFinderService } from "@/application/services/redfin-url-finder.service";
import { RedfinPropertyExtractor } from "@/application/services/redfin-property-extractor.service";
import { MatchCalculator } from "@/application/services/match-calculator.service";
import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";

export interface CompareListingsByAddressInput {
  address: string;
  timeoutMs?: number;
}

export interface CompareListingsByAddressResult {
  matchPercentage: number;
  matches: { bedrooms?: boolean; baths?: boolean };
  airbnb: { url: string; bedrooms?: number; baths?: number };
  redfin: { url: string; beds?: number; baths?: number };
}

export class CompareListingsByAddressWorkflow {
  constructor(
    private readonly addressResolver: AddressResolverPort,
    private readonly shortTermProvider: ShortTermRentalProviderPort,
    private readonly redfinFinder: RedfinUrlFinderService,
    private readonly propertyContent: PropertyJsonFetchPort,
    private readonly redfinExtractor: RedfinPropertyExtractor,
    private readonly matcher: MatchCalculator
  ) {}

  async execute(
    input: CompareListingsByAddressInput
  ): Promise<Result<CompareListingsByAddressResult, AppError>> {
    const address = input.address.trim();
    const timeoutMs = input.timeoutMs;

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
        // Get Airbnb property details (includes bedrooms, baths, url)
        const airbnbResult = await this.shortTermProvider.getDetails(listingId, timeoutMs);
        return airbnbResult;
      })
      .flatMap(async (airbnb: RentalPropertyDetails) => {
        // Find Redfin URL
        const urlResult = await this.redfinFinder.findRedfinUrlForAddress(address);
        return urlResult.map((redfinUrl: string) => ({
          airbnb,
          redfinUrl,
        }));
      })
      .flatMap(async ({ airbnb, redfinUrl }: { airbnb: RentalPropertyDetails; redfinUrl: string }) => {
        // Fetch Redfin JSON
        const jsonResult = await this.propertyContent.fetchJson(redfinUrl, timeoutMs);
        return jsonResult.map((redfinJson: unknown) => ({
          airbnb,
          redfinUrl,
          redfinJson,
        }));
      })
      .flatMap(({ airbnb, redfinUrl, redfinJson }: { airbnb: RentalPropertyDetails; redfinUrl: string; redfinJson: unknown }) => {
        // Extract Redfin data
        const redfinData = this.redfinExtractor.extract(redfinJson);

        // Compute matches
        const matchResult = this.matcher.calcMatch(
          airbnb.bedrooms,
          redfinData.beds,
          airbnb.baths,
          redfinData.baths
        );

        // Fail if no comparable fields found
        if (matchResult.totalComparisons === 0) {
          return Result.Err({
            kind: "InvalidResponseError",
            message: "No comparable fields found",
          } as AppError);
        }

        // Return the DTO
        return Result.Ok({
          matchPercentage: matchResult.percentage,
          matches: {
            bedrooms: matchResult.bedroomsMatch,
            baths: matchResult.bathsMatch,
          },
          airbnb: {
            url: airbnb.url,
            bedrooms: airbnb.bedrooms,
            baths: airbnb.baths,
          },
          redfin: {
            url: redfinUrl,
            beds: redfinData.beds,
            baths: redfinData.baths,
          },
        } satisfies CompareListingsByAddressResult);
      })
      .toPromise();
  }
}

