import { GetPdpFromAddressWorkflow } from "@/application/workflows/get-pdp-from-address.workflow";
import { RedfinUrlFinderService } from "@/application/services/redfin-url-finder.service";
import { RedfinHasDataService } from "@/application/services/redfin-hasdata.service";
import { AirbnbPdpExtractor } from "@/application/services/airbnb-pdp-extractor.service";
import { RedfinPropertyExtractor } from "@/application/services/redfin-property-extractor.service";
import { MatchCalculator } from "@/application/services/match-calculator.service";
import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";

export interface CompareListingsByAddressConfig {
  defaultTimeoutMs?: number;
}

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
    private readonly pdpWorkflow: GetPdpFromAddressWorkflow,
    private readonly redfinFinder: RedfinUrlFinderService,
    private readonly hasData: RedfinHasDataService,
    private readonly airbnbExtractor: AirbnbPdpExtractor,
    private readonly redfinExtractor: RedfinPropertyExtractor,
    private readonly matcher: MatchCalculator,
    private readonly config: CompareListingsByAddressConfig
  ) {}

  async execute(
    input: CompareListingsByAddressInput
  ): Promise<Result<CompareListingsByAddressResult, AppError>> {
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
        // Fetch PDP data
        const pdpResult = await this.pdpWorkflow.execute({ address: addr, timeoutMs });
        return pdpResult;
      })
      .flatMap((pdp) => {
        // Explicitly check for listingId
        if (!pdp.listingId) {
          return Result.Err({
            kind: "InvalidResponseError",
            message: "No listingId found in PDP response",
          } as AppError);
        }

        // Extract Airbnb data
        const airbnbData = this.airbnbExtractor.extract(pdp);

        return Result.Ok({
          listingId: pdp.listingId,
          airbnbData,
        });
      })
      .flatMap(async ({ listingId, airbnbData }) => {
        // Find Redfin URL
        const urlResult = await this.redfinFinder.findRedfinUrlForAddress(address);
        return urlResult.map((redfinUrl) => ({
          listingId,
          airbnbData,
          redfinUrl,
        }));
      })
      .flatMap(async ({ listingId, airbnbData, redfinUrl }) => {
        // Fetch Redfin JSON
        const jsonResult = await this.hasData.fetch(redfinUrl, timeoutMs);
        return jsonResult.map((response) => ({
          listingId,
          airbnbData,
          redfinUrl,
          redfinJson: response.data,
        }));
      })
      .flatMap(({ listingId, airbnbData, redfinUrl, redfinJson }) => {
        // Extract Redfin data
        const redfinData = this.redfinExtractor.extract(redfinJson);

        // Compute matches
        const matchResult = this.matcher.calcMatch(
          airbnbData.bedrooms,
          redfinData.beds,
          airbnbData.baths,
          redfinData.baths
        );

        // Fail if no comparable fields found
        if (matchResult.totalComparisons === 0) {
          return Result.Err({
            kind: "InvalidResponseError",
            message: "No comparable fields found",
          } as AppError);
        }

        // Build Airbnb URL
        const airbnbUrl = `https://www.airbnb.com/rooms/${listingId}`;

        // Return the DTO
        return Result.Ok({
          matchPercentage: matchResult.percentage,
          matches: {
            bedrooms: matchResult.bedroomsMatch,
            baths: matchResult.bathsMatch,
          },
          airbnb: {
            url: airbnbUrl,
            bedrooms: airbnbData.bedrooms,
            baths: airbnbData.baths,
          },
          redfin: {
            url: redfinUrl,
            beds: redfinData.beds,
            baths: redfinData.baths,
          },
        });
      })
      .toPromise();
  }
}

