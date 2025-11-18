import type { AppError } from "@poc/core";

export function logRequest(req: Request) {
  const url = new URL(req.url);
  console.log("[HTTP] request", {
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
  });
}

export function logAppError(context: string, error: AppError) {
  console.error("[HTTP] error", {
    context,
    kind: error.kind,
    message: error.message,
  });
}

