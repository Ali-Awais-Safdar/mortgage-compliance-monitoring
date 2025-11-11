export type AppError =
  | { kind: "TimeoutError"; timeoutMs?: number; message?: string }
  | { kind: "TransportError"; message: string; cause?: unknown }
  | { kind: "InvalidResponseError"; message: string }
  | { kind: "InvalidInputError"; message: string };
