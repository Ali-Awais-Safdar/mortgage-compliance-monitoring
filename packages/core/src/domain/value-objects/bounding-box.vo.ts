import { Result } from "@carbonteq/fp";
import type { BoundingBoxParseError } from "@/domain/errors/domain-error";

/**
 * BoundingBox represents a geographic bounding box as a tuple of four numbers:
 * [neLat, neLng, swLat, swLng]
 * - neLat: Northeast latitude
 * - neLng: Northeast longitude
 * - swLat: Southwest latitude
 * - swLng: Southwest longitude
 */
export type BoundingBox = [number, number, number, number];

export function parseBoundingBox(input: string): Result<BoundingBox, BoundingBoxParseError> {
  if (!input || typeof input !== "string") {
    return Result.Err({
      _tag: "BoundingBoxParseError",
      message: "Bounding box input must be a non-empty string",
    });
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return Result.Err({
      _tag: "BoundingBoxParseError",
      message: "Bounding box input cannot be empty",
    });
  }

  const parts = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length !== 4) {
    return Result.Err({
      _tag: "BoundingBoxParseError",
      message: 'Invalid bbox format. Expected "neLat,neLng,swLat,swLng", got ' +
        `${parts.length} segment(s)`,
    });
  }

  const numbers = parts.map((p) => Number.parseFloat(p));
  const hasNaN = numbers.some((n) => !Number.isFinite(n));

  if (hasNaN) {
    return Result.Err({
      _tag: "BoundingBoxParseError",
      message: "bbox must contain only finite numbers",
    });
  }

  const [neLat, neLng, swLat, swLng] = numbers;

  return Result.Ok([neLat, neLng, swLat, swLng] as BoundingBox);
}

