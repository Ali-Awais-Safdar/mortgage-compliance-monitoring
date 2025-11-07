export type AppError =
  | { kind: "TimeoutError"; timeoutMs?: number; message?: string }
  | { kind: "TransportError"; message: string; cause?: unknown }
  | { kind: "InvalidResponseError"; message: string };

export const toAppError = (e: unknown, ctx?: { timeoutMs?: number }): AppError => {
  if (e && typeof e === "object" && (e as { name?: string }).name === "AbortError") {
    return { kind: "TimeoutError", timeoutMs: ctx?.timeoutMs, message: "Request timed out" };
  }
  return { kind: "TransportError", message: e instanceof Error ? e.message : "Unknown transport error", cause: e };
};

