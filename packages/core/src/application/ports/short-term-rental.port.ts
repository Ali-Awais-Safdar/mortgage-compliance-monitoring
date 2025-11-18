import type { Result } from "@carbonteq/fp";
import type { AppError } from "../errors/app-error";
import type { ResolvedSearchFlags } from "./address-resolver.port";

export interface ShortTermRentalProviderPort {
  findListingIds(flags: ResolvedSearchFlags, timeoutMs?: number): Promise<Result<string[], AppError>>;
}

