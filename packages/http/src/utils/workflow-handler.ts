import { matchRes, type Result } from "@carbonteq/fp";
import type { AppError } from "@poc/core";
import { mapAppErrorToHttpStatus } from "../errors/http-status.mapper";
import { parseAddressRequest } from "./address-request.parser";
import { logRequest, logAppError } from "../logging";

/**
 * Generic handler for address-based workflow requests.
 * 
 * Common pattern:
 * 1. Log request
 * 2. Parse address from query params
 * 3. On parse error: log, map to HTTP status, return JSON error
 * 4. On parse success: execute workflow
 * 5. On workflow error: log, map to HTTP status, return JSON error
 * 6. On workflow success: map result to JSON and return 200
 */
export async function handleAddressWorkflow<T>(
  req: Request,
  defaultTimeoutMs: number | undefined,
  workflowName: string,
  executeWorkflow: (address: string, timeoutMs?: number) => Promise<Result<T, AppError>>,
  mapSuccess: (data: T, address: string) => unknown
): Promise<Response> {
  logRequest(req);

  const parsed = await parseAddressRequest(req, defaultTimeoutMs);

  if (parsed.isErr()) {
    const error = parsed.unwrapErr();
    logAppError(`${workflowName}.parse`, error);
    const status = mapAppErrorToHttpStatus(error);
    return new Response(
      JSON.stringify({ error: error.message ?? "Unknown error" }),
      {
        status,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const { address, timeoutMs } = parsed.unwrap();
  const result = await executeWorkflow(address, timeoutMs);

  return matchRes(result, {
    Ok: (data) => {
      const responseBody = mapSuccess(data, address);
      return new Response(JSON.stringify(responseBody, null, 2), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    Err: (error: AppError) => {
      logAppError(`${workflowName}.workflow`, error);
      const status = mapAppErrorToHttpStatus(error);
      return new Response(
        JSON.stringify({ error: error.message ?? "Unknown error" }),
        {
          status,
          headers: { "content-type": "application/json" },
        },
      );
    },
  });
}

