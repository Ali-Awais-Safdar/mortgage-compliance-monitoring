import type { Result } from "@carbonteq/fp";
import type { AppError } from "../errors/app-error";

export interface ResolvedSearchFlags {
  bbox: string;
  zoomLevel?: number;
  queryAddress?: string;
  refinementPath?: string;
  searchByMap?: boolean;
  poiPlace?: string;
  poiAcp?: string;
}

export interface AddressResolverPort {
  resolve(
    address: string
  ): Promise<Result<ResolvedSearchFlags, AppError>> | Result<ResolvedSearchFlags, AppError>;
}

