import type {
  BoundingBoxParseError,
  AddressError,
  GeoPointError,
  DomainError,
} from "@/domain/errors/domain-error";
import type { AppError } from "../errors/app-error";

export function mapDomainErrorToAppError(err: DomainError): AppError {
  switch (err._tag) {
    case "BoundingBoxParseError":
    case "AddressError":
    case "GeoPointError":
      return {
        kind: "InvalidInputError",
        message: err.message,
      };
    default:

      return {
        kind: "InvalidInputError",
        message: "Unknown domain error",
      };
  }
}

export function mapBoundingBoxErrorToAppError(err: BoundingBoxParseError): AppError {
  return mapDomainErrorToAppError(err);
}

export function mapAddressErrorToAppError(err: AddressError): AppError {
  return mapDomainErrorToAppError(err);
}

export function mapGeoPointErrorToAppError(err: GeoPointError): AppError {
  return mapDomainErrorToAppError(err);
}

