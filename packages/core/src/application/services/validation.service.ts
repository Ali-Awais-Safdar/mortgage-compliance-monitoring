import { Result } from "@carbonteq/fp";

import type { AppError } from "../errors/app-error";

export function guardBBoxString(bbox?: string): Result<true, AppError> {
  if (!bbox) return Result.Ok(true);

  const parts = bbox
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length !== 4) {
    return Result.Err({
      kind: "InvalidInputError",
      message: 'Invalid bbox format. Expected "neLat,neLng,swLat,swLng"',
    });
  }

  const nums = parts.map((p) => Number.parseFloat(p));
  const hasNaN = nums.some((n) => !Number.isFinite(n));

  if (hasNaN) {
    return Result.Err({
      kind: "InvalidInputError",
      message: "bbox must contain only finite numbers",
    });
  }

  return Result.Ok(true);
}

export function guardOverrides(
  overrides?: Array<{ path: string; value: unknown }>,
): Result<true, AppError> {
  if (!overrides || overrides.length === 0) return Result.Ok(true);

  const invalid = overrides.find((o) => !o.path || typeof o.path !== "string");

  if (invalid) {
    return Result.Err({
      kind: "InvalidInputError",
      message: "Override path cannot be empty",
    });
  }

  return Result.Ok(true);
}

export function guardListingId(listingId?: string): Result<true, AppError> {
  if (listingId === undefined || listingId === null) return Result.Ok(true);

  const trimmed = String(listingId).trim();

  if (!trimmed) {
    return Result.Err({
      kind: "InvalidInputError",
      message: "listingId cannot be empty/blank",
    });
  }

  return Result.Ok(true);
}

