import type { GetPdpFromAddressWorkflow, PdpDerivedData } from "@poc/core";
import { PdpJsonSerializer, ResponsePostprocessService } from "@poc/core";
import { handleAddressWorkflow } from "../utils/workflow-handler";

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
  return handleAddressWorkflow<PdpDerivedData[]>(
    req,
    ctx.defaultTimeoutMs,
    "pdp",
    (address, timeoutMs) => ctx.workflow.execute({ address, timeoutMs }),
    (derivedList, address) => {
      const dtos = derivedList.map((d) =>
        ctx.serializer.serialize(d, ctx.postprocess),
      );
      console.log("[HTTP] pdp.ok", { address, listings: derivedList.length });
      return dtos;
    }
  );
}

