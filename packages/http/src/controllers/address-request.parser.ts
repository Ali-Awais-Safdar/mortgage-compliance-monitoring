import { Result } from "@carbonteq/fp";
import type { AppError } from "@poc/core";

export interface AddressRequest {
  address: string;
  timeoutMs?: number;
}

export async function parseAddressRequest(
  req: Request,
  defaultTimeoutMs?: number,
): Promise<Result<AddressRequest, AppError>> {
  const url = new URL(req.url);

  const timeoutParam = url.searchParams.get("timeout");
  const timeoutMs =
    timeoutParam != null ? Number.parseInt(timeoutParam, 10) : defaultTimeoutMs;
  const safeTimeout =
    timeoutMs != null && !Number.isNaN(timeoutMs) ? timeoutMs : undefined;

  // Address is required as a query parameter (?address=...)
  const addressParam = url.searchParams.get("address");
  const trimmed = addressParam?.trim() ?? "";

  if (trimmed.length === 0) {
    return Result.Err({
      kind: "InvalidInputError",
      message: "Address is required and cannot be empty",
    } as AppError);
  }

  return Result.Ok({
    address: trimmed,
    timeoutMs: safeTimeout,
  });
}

