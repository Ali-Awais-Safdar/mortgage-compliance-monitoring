import type { SaveRedfinJsonFromAddressWorkflow } from "@poc/core";
import { matchRes } from "@carbonteq/fp";
import { mapAppErrorToHttpStatus } from "../errors/http-status.mapper";
import { parseAddressRequest } from "./address-request.parser";
import { logRequest, logAppError } from "../logging";

export interface RedfinControllerContext {
  workflow: SaveRedfinJsonFromAddressWorkflow;
  defaultTimeoutMs?: number;
}

export async function handleRedfinJsonRequest(
  req: Request,
  ctx: RedfinControllerContext
): Promise<Response> {
  logRequest(req);

  const parsed = await parseAddressRequest(req, ctx.defaultTimeoutMs);

  if (parsed.isErr()) {
    const error = parsed.unwrapErr();
    logAppError("redfin.parse", error);
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
      console.log("[HTTP] redfin.ok", { address, url: data.url });
      return new Response(
        JSON.stringify({ url: data.url, savedPath: data.savedPath }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    },
    Err: (error: import("@poc/core").AppError) => {
      logAppError("redfin.workflow", error);
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

