import type { CompareListingsByAddressWorkflow, CompareResponseDTO } from "@poc/core";
import { handleAddressWorkflow } from "../utils/workflow-handler";

export interface CompareControllerContext {
  workflow: CompareListingsByAddressWorkflow;
  defaultTimeoutMs?: number;
}

export async function handleCompareRequest(
  req: Request,
  ctx: CompareControllerContext
): Promise<Response> {
  return handleAddressWorkflow<CompareResponseDTO>(
    req,
    ctx.defaultTimeoutMs,
    "compare",
    (address, timeoutMs) => ctx.workflow.execute({ address, timeoutMs }),
    (data, address) => {
      console.log("[HTTP] compare.ok", { address, listings: data.listingDetails.length });
      return data;
    }
  );
}

