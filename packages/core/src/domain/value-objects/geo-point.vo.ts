import { Result } from "@carbonteq/fp";
import type { GeoPointError } from "@/domain/errors/domain-error";

/**
 * GeoPoint represents a geographic point with latitude and longitude.
 * - lat: Latitude in degrees, must be within [-90, 90]
 * - lng: Longitude in degrees, must be within [-180, 180]
 */
export interface GeoPoint {
  lat: number;
  lng: number;
}

export function parseGeoPoint(latStr: string, lonStr: string): Result<GeoPoint, GeoPointError> {
  if (typeof latStr !== "string" || typeof lonStr !== "string") {
    return Result.Err({
      _tag: "GeoPointError",
      message: "Latitude and longitude must be strings",
    });
  }

  const lat = Number.parseFloat(latStr.trim());
  const lng = Number.parseFloat(lonStr.trim());

  if (!Number.isFinite(lat)) {
    return Result.Err({
      _tag: "GeoPointError",
      message: `Invalid latitude: "${latStr}" is not a finite number`,
    });
  }

  if (!Number.isFinite(lng)) {
    return Result.Err({
      _tag: "GeoPointError",
      message: `Invalid longitude: "${lonStr}" is not a finite number`,
    });
  }

  if (lat < -90 || lat > 90) {
    return Result.Err({
      _tag: "GeoPointError",
      message: `Latitude must be within [-90, 90], got ${lat}`,
    });
  }

  if (lng < -180 || lng > 180) {
    return Result.Err({
      _tag: "GeoPointError",
      message: `Longitude must be within [-180, 180], got ${lng}`,
    });
  }

  return Result.Ok({ lat, lng });
}

