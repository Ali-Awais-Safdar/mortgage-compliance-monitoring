import type { Result } from "@carbonteq/fp";
import type { AppError } from "../errors/app-error";
import type { ResolvedSearchFlags } from "@/domain/value-objects/search-flags.vo";

export interface ShortTermRentalProviderPort {
  findListingIds(flags: ResolvedSearchFlags, timeoutMs?: number): Promise<Result<string[], AppError>>;
}

