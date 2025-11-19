import { Result } from "@carbonteq/fp";
import type { GeoPoint } from "@/domain/value-objects/geo-point.vo";
import type { BoundingBox } from "@/domain/value-objects/bounding-box.vo";
import type { DomainError, GeoPointError } from "@/domain/errors/domain-error";

/**
 * Specification for a bounding box computed from fixed meter dimensions.
 */
export interface MeterBoxSpec {
  widthMeters: number;
  heightMeters: number;
  safetyMeters: number;
}

/**
 * Specification for a bounding box computed from zoom level and pixel dimensions.
 */
export interface ZoomViewportSpec {
  zoom: number;
  widthPx: number;
  heightPx: number;
  safetyMeters: number;
}

/**
 * Computes meters per degree of latitude at a given latitude using WGS-84 series.
 * Formula: m/deg_lat(φ) = 111132.92 - 559.82*cos(2φ) + 1.175*cos(4φ) - 0.0023*cos(6φ)
 */
export function metersPerDegreeLat(phiRad: number): number {
  const cos2 = Math.cos(2 * phiRad);
  const cos4 = Math.cos(4 * phiRad);
  const cos6 = Math.cos(6 * phiRad);
  return 111132.92 - 559.82 * cos2 + 1.175 * cos4 - 0.0023 * cos6;
}

/**
 * Computes meters per degree of longitude at a given latitude using WGS-84 series.
 * Formula: m/deg_lon(φ) = 111412.84*cos(φ) - 93.5*cos(3φ) + 0.118*cos(5φ)
 */
export function metersPerDegreeLon(phiRad: number): number {
  const cos1 = Math.cos(phiRad);
  const cos3 = Math.cos(3 * phiRad);
  const cos5 = Math.cos(5 * phiRad);
  return 111412.84 * cos1 - 93.5 * cos3 + 0.118 * cos5;
}

/**
 * Normalizes longitude to the range [-180, 180].
 */
function normalizeLon(lon: number): number {
  // Wrap into [-180, 180]
  let normalized = lon;
  while (normalized > 180) {
    normalized -= 360;
  }
  while (normalized < -180) {
    normalized += 360;
  }
  return normalized;
}

/**
 * Validates that a GeoPoint has valid coordinates.
 * Returns an error if lat or lng are out of valid ranges.
 */
function validateGeoPoint(point: GeoPoint): Result<GeoPoint, GeoPointError> {
  if (point.lat < -90 || point.lat > 90) {
    return Result.Err({
      _tag: "GeoPointError",
      message: `Latitude must be within [-90, 90], got ${point.lat}`,
    });
  }

  if (point.lng < -180 || point.lng > 180) {
    return Result.Err({
      _tag: "GeoPointError",
      message: `Longitude must be within [-180, 180], got ${point.lng}`,
    });
  }

  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return Result.Err({
      _tag: "GeoPointError",
      message: "Latitude and longitude must be finite numbers",
    });
  }

  return Result.Ok(point);
}

/**
 * Computes a bounding box from a center point and meter-based dimensions.
 * Uses WGS-84 formulas to convert meters to degrees at the given latitude.
 */
export function bboxFromMeters(
  center: GeoPoint,
  spec: MeterBoxSpec
): Result<BoundingBox, DomainError> {
  // Validate center point
  const validationResult = validateGeoPoint(center);
  if (validationResult.isErr()) {
    return validationResult;
  }

  const validatedCenter = validationResult.unwrap();

  // Convert latitude to radians
  const phiRad = (validatedCenter.lat * Math.PI) / 180;

  // Compute meters per degree at this latitude
  const mPerDegLat = metersPerDegreeLat(phiRad);
  const mPerDegLon = metersPerDegreeLon(phiRad);

  // Apply safety margin: add 2 * safetyMeters to each dimension
  const hPrime = spec.heightMeters + 2 * spec.safetyMeters;
  const wPrime = spec.widthMeters + 2 * spec.safetyMeters;

  // Compute half-sizes in degrees
  const deltaLat = (hPrime / 2) / mPerDegLat;
  const deltaLon = (wPrime / 2) / mPerDegLon;

  // Build bounds
  const north = validatedCenter.lat + deltaLat;
  const south = validatedCenter.lat - deltaLat;
  const east = normalizeLon(validatedCenter.lng + deltaLon);
  const west = normalizeLon(validatedCenter.lng - deltaLon);

  // Return in Airbnb format: [neLat, neLng, swLat, swLng]
  // which is [north, east, south, west]
  return Result.Ok([north, east, south, west] as BoundingBox);
}

/**
 * Computes ground resolution (meters per pixel) using Web Mercator projection.
 * Formula: res = (156543.03392 * cos(φ)) / (2^z)
 */
export function groundResolution(lat: number, zoom: number): number {
  const phiRad = (lat * Math.PI) / 180;
  return (156543.03392 * Math.cos(phiRad)) / (2 ** zoom);
}

/**
 * Computes a bounding box from a center point and zoom-based viewport dimensions.
 * First converts pixels to meters using ground resolution, then uses bboxFromMeters.
 */
export function bboxFromZoom(
  center: GeoPoint,
  spec: ZoomViewportSpec
): Result<{ bbox: BoundingBox; widthMeters: number; heightMeters: number }, DomainError> {
  // Validate center point
  const validationResult = validateGeoPoint(center);
  if (validationResult.isErr()) {
    return validationResult;
  }

  const validatedCenter = validationResult.unwrap();

  // Compute ground resolution (meters per pixel)
  const res = groundResolution(validatedCenter.lat, spec.zoom);

  // Convert pixels to meters
  const widthMeters = res * spec.widthPx;
  const heightMeters = res * spec.heightPx;

  // Use bboxFromMeters with the computed meter dimensions
  const meterSpec: MeterBoxSpec = {
    widthMeters,
    heightMeters,
    safetyMeters: spec.safetyMeters,
  };

  const bboxResult = bboxFromMeters(validatedCenter, meterSpec);
  if (bboxResult.isErr()) {
    return bboxResult;
  }

  return bboxResult.map((bbox) => ({
    bbox,
    widthMeters,
    heightMeters,
  }));
}

