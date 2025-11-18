import type { BoundingBoxParseError, AddressError } from "@/domain/errors/domain-error";
import type { AppError } from "../errors/app-error";

export function mapBoundingBoxErrorToAppError(err: BoundingBoxParseError): AppError {
  return {
    kind: "InvalidInputError",
    message: err.message,
  };
}

export function mapAddressErrorToAppError(err: AddressError): AppError {
  return {
    kind: "InvalidInputError",
    message: err.message,
  };
}

