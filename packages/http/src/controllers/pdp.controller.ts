import type { GetPdpFromAddressWorkflow } from "@poc/core";
import { PdpOutputComposer, ResponsePostprocessService } from "@poc/core";
import { matchRes } from "@carbonteq/fp";
import { mapAppErrorToHttpStatus } from "../errors/http-status.mapper";

export interface PdpControllerContext {
  workflow: GetPdpFromAddressWorkflow;
  composer: PdpOutputComposer;
  postprocess: ResponsePostprocessService;
  defaultTimeoutMs?: number;
}

export async function handlePdpRequest(
  req: Request,
  ctx: PdpControllerContext
): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  // Parse JSON body
  let body: { address?: string };
  try {
    const parsed = await req.json();
    body = typeof parsed === "object" && parsed !== null ? (parsed as { address?: string }) : {};
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );
  }

  // Validate non-empty address
  if (!body.address || typeof body.address !== "string" || body.address.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "Address is required and cannot be empty" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );
  }

  // Parse timeout from query params
  const url = new URL(req.url);
  const timeoutParam = url.searchParams.get("timeout");
  const timeoutMs = timeoutParam ? Number.parseInt(timeoutParam, 10) : ctx.defaultTimeoutMs;

  // Call workflow
  const result = await ctx.workflow.execute({
    address: body.address.trim(),
    timeoutMs: timeoutMs && !Number.isNaN(timeoutMs) ? timeoutMs : undefined,
  });

  // Handle result
  return matchRes(result, {
    Ok: (derived) => {
      const composedText = ctx.composer.compose(derived, ctx.postprocess);
      return new Response(composedText, {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    },
    Err: (error: import("@poc/core").AppError) => {
      const status = mapAppErrorToHttpStatus(error);
      return new Response(
        JSON.stringify({ error: error.message ?? "Unknown error" }),
        {
          status,
          headers: { "content-type": "application/json" },
        }
      );
    },
  });
}

