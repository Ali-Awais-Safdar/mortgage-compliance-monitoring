import { Result } from "@carbonteq/fp";
import type { AppError } from "@poc/core";
import { parseAddress, mapAddressErrorToAppError } from "@poc/core";

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

  // Handle missing parameter (boundary concern)
  if (addressParam == null) {
    return Result.Err({
      kind: "InvalidInputError",
      message: "Address query parameter is required",
    } as AppError);
  }

  // Delegate invariant to domain guard
  const addressRes = parseAddress(addressParam);

  if (addressRes.isErr()) {
    return Result.Err(
      mapAddressErrorToAppError(addressRes.unwrapErr())
    );
  }

  const address = addressRes.unwrap().raw;

  return Result.Ok({
    address,
    timeoutMs: safeTimeout,
  });
}

