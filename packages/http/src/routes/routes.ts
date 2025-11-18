import { handlePdpRequest, type PdpControllerContext } from "../controllers/pdp.controller";
import { handleRedfinJsonRequest, type RedfinControllerContext } from "../controllers/redfin.controller";
import { handleCompareRequest, type CompareControllerContext } from "../controllers/compare.controller";

export interface ServerContext {
  pdpController: PdpControllerContext;
  redfinController: RedfinControllerContext;
  compareController: CompareControllerContext;
}

export async function registerRoutes(
  req: Request,
  ctx: ServerContext
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;

  // Health check route
  if (path === "/health" && req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // PDP HTML route (GET-only)
  if (path === "/pdp-html" && req.method === "GET") {
    return await handlePdpRequest(req, ctx.pdpController);
  }

  // Redfin JSON route (GET-only)
  if (path === "/redfin-json" && req.method === "GET") {
    return await handleRedfinJsonRequest(req, ctx.redfinController);
  }

  // Compare listings route (GET-only)
  if (path === "/compare" && req.method === "GET") {
    return await handleCompareRequest(req, ctx.compareController);
  }

  // Not found
  return null;
}

