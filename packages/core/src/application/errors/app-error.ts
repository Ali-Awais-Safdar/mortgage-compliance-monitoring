export type AppError =
  | { kind: "TimeoutError"; timeoutMs?: number; message?: string }
  | { kind: "TransportError"; message: string; cause?: unknown }
  | { kind: "InvalidResponseError"; message: string; statusCode?: number }
  | { kind: "InvalidInputError"; message: string };
