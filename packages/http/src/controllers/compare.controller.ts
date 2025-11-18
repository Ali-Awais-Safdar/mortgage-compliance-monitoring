import type { CompareListingsByAddressWorkflow } from "@poc/core";
import { matchRes } from "@carbonteq/fp";
import { mapAppErrorToHttpStatus } from "../errors/http-status.mapper";
import { parseAddressRequest } from "./address-request.parser";
import { logRequest, logAppError } from "../logging";

export interface CompareControllerContext {
  workflow: CompareListingsByAddressWorkflow;
  defaultTimeoutMs?: number;
}

export async function handleCompareRequest(
  req: Request,
  ctx: CompareControllerContext
): Promise<Response> {
  logRequest(req);

  const parsed = await parseAddressRequest(req, ctx.defaultTimeoutMs);

  if (parsed.isErr()) {
    const error = parsed.unwrapErr();
    logAppError("compare.parse", error);
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
  const result = await ctx.workflow.execute({ address, timeoutMs });

  return matchRes(result, {
    Ok: (data) => {
      console.log("[HTTP] compare.ok", { address, listings: data.listingDetails.length });
      return new Response(JSON.stringify(data, null, 2), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    Err: (error: import("@poc/core").AppError) => {
      logAppError("compare.workflow", error);
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

