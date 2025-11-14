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

  // PDP HTML route
  if (path === "/pdp-html" && req.method === "POST") {
    return await handlePdpRequest(req, ctx.pdpController);
  }

  // Redfin JSON route
  if (path === "/redfin-json" && req.method === "POST") {
    return await handleRedfinJsonRequest(req, ctx.redfinController);
  }

  // Compare listings route
  if (path === "/compare" && req.method === "POST") {
    return await handleCompareRequest(req, ctx.compareController);
  }

  // Not found
  return null;
}

