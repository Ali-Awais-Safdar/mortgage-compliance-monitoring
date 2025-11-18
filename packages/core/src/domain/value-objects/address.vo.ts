import { Result } from "@carbonteq/fp";
import type { AddressError } from "@/domain/errors/domain-error";

export interface Address {
  raw: string; // trimmed, validated
}

export function parseAddress(input: string): Result<Address, AddressError> {
  const trimmed = input.trim();
  if (!trimmed) {
    return Result.Err({ _tag: "AddressError", message: "Address cannot be empty" });
  }
  return Result.Ok({ raw: trimmed });
}

