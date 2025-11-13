import type { AppError } from "@poc/core";

export const toAppError = (e: unknown, ctx?: { timeoutMs?: number }): AppError => {
  if (e && typeof e === "object" && (e as { name?: string }).name === "AbortError") {
    return { kind: "TimeoutError", timeoutMs: ctx?.timeoutMs, message: "Request timed out" };
  }

  return {
    kind: "TransportError",
    message: e instanceof Error ? e.message : "Unknown transport error",
    cause: e,
  };
};

