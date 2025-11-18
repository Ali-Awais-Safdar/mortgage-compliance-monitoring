import type { SaveRedfinJsonFromAddressWorkflow } from "@poc/core";
import { handleAddressWorkflow } from "../utils/workflow-handler";

interface SaveRedfinJsonFromAddressResult {
  url: string;
  savedPath: string;
}

export interface RedfinControllerContext {
  workflow: SaveRedfinJsonFromAddressWorkflow;
  defaultTimeoutMs?: number;
}

export async function handleRedfinJsonRequest(
  req: Request,
  ctx: RedfinControllerContext
): Promise<Response> {
  return handleAddressWorkflow<SaveRedfinJsonFromAddressResult>(
    req,
    ctx.defaultTimeoutMs,
    "redfin",
    (address, timeoutMs) => ctx.workflow.execute({ address, timeoutMs }),
    (data, address) => {
      console.log("[HTTP] redfin.ok", { address, url: data.url });
      return { url: data.url, savedPath: data.savedPath };
    }
  );
}

