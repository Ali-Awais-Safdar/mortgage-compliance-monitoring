import type { AppError } from "@poc/core";

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

