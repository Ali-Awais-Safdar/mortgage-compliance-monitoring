import { handlePdpRequest, type PdpControllerContext } from "../controllers/pdp.controller";

export interface ServerContext {
  pdpController: PdpControllerContext;
}

export async function registerPdpRoutes(
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

  // Not found
  return null;
}

