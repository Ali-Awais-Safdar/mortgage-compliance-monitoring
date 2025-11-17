import type { Result } from "@carbonteq/fp";
import type { AppError } from "../errors/app-error";
import type { ResolvedSearchFlags } from "./address-resolver.port";

export interface RentalPropertyDetails {
  listingId: string;
  url: string;
  bedrooms?: number;
  baths?: number;
}

export interface ShortTermRentalProviderPort {
  findListingId(flags: ResolvedSearchFlags, timeoutMs?: number): Promise<Result<string, AppError>>;

  getDetails(listingId: string, timeoutMs?: number): Promise<Result<RentalPropertyDetails, AppError>>;
}

