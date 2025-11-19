import type { Result } from "@carbonteq/fp";
import type { AppError } from "../errors/app-error";
import type { GeoPoint } from "@/domain/value-objects/geo-point.vo";

/**
 * Port for geocoding addresses to geographic coordinates.
 */
export interface GeocodingPort {
  forwardGeocode(
    address: string,
    timeoutMs?: number
  ): Promise<Result<GeoPoint, AppError>>;
}

