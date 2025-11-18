import type { GetPdpFromAddressWorkflow } from "@poc/core";
import { PdpJsonSerializer, ResponsePostprocessService } from "@poc/core";
import { matchRes } from "@carbonteq/fp";
import { mapAppErrorToHttpStatus } from "../errors/http-status.mapper";
import { parseAddressRequest } from "./address-request.parser";
import { logRequest, logAppError } from "../logging";

export interface PdpControllerContext {
  workflow: GetPdpFromAddressWorkflow;
  serializer: PdpJsonSerializer;
  postprocess: ResponsePostprocessService;
  defaultTimeoutMs?: number;
}

export async function handlePdpRequest(
  req: Request,
  ctx: PdpControllerContext
): Promise<Response> {
  logRequest(req);

  const parsed = await parseAddressRequest(req, ctx.defaultTimeoutMs);

  if (parsed.isErr()) {
    const error = parsed.unwrapErr();
    logAppError("pdp.parse", error);
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
    Ok: (derivedList) => {
      const dtos = derivedList.map((d) =>
        ctx.serializer.serialize(d, ctx.postprocess),
      );
      console.log("[HTTP] pdp.ok", { address, listings: derivedList.length });
      return new Response(JSON.stringify(dtos, null, 2), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    Err: (error: import("@poc/core").AppError) => {
      logAppError("pdp.workflow", error);
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

