import type { Result } from "@carbonteq/fp";
import type { AppError } from "../errors/app-error";
import type { ResolvedSearchFlags } from "@/domain/value-objects/search-flags.vo";

export interface AddressResolverPort {
  resolve(
    address: string
  ): Promise<Result<ResolvedSearchFlags, AppError>> | Result<ResolvedSearchFlags, AppError>;
}

