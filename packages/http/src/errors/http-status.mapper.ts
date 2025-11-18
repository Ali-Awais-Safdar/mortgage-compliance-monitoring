import type { AppError } from "@poc/core";

/**
 * Maps application errors to HTTP status codes.
 * 
 * Error mappings:
 * - InvalidInputError → 400 (e.g., "No Redfin URL found..." or invalid address)
 * - InvalidResponseError → 502 (e.g., no listingIds, no comparable fields)
 * - TransportError → 502 (HTTP/network errors)
 * - TimeoutError → 504 (request timeout)
 */
export function mapAppErrorToHttpStatus(error: AppError): number {
  switch (error.kind) {
    case "InvalidInputError":
      return 400;
    case "TransportError":
      return 502;
    case "InvalidResponseError":
      return 502;
    case "TimeoutError":
      return 504;
    default:
      return 500;
  }
}

