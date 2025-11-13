import {
  GetPdpFromAddressWorkflow,
  PdpOutputComposer,
} from "@poc/core";
import {
  StaticAddressResolverAdapter,
  createCoreWorkflow,
} from "@poc/infra";
import { loadConfig } from "./config/env.config";
import { registerPdpRoutes, type ServerContext } from "./routes/pdp.routes";

// Load configuration (validates env vars and fails fast if missing)
const config = loadConfig();

// Build dependencies using factory
const { callWorkflow, postprocess } = createCoreWorkflow();
const addressResolver = new StaticAddressResolverAdapter();

const workflow = new GetPdpFromAddressWorkflow(
  callWorkflow,
  addressResolver,
  {
    airbnbSearchUrl: config.airbnbSearchUrl,
    airbnbUrl: config.airbnbUrl,
    airbnbSearchBody: config.airbnbSearchBody,
    apiKey: config.apiKey,
    defaultTimeoutMs: config.defaultTimeoutMs,
  }
);

const composer = new PdpOutputComposer();

// Create server context
const serverContext: ServerContext = {
  pdpController: {
    workflow,
    composer,
    postprocess,
    defaultTimeoutMs: config.defaultTimeoutMs,
  },
};

// Start Bun server
console.log(`Starting server on port ${config.port}...`);

Bun.serve({
  port: config.port,
  async fetch(req: Request): Promise<Response> {
    const response = await registerPdpRoutes(req, serverContext);
    if (response) {
      return response;
    }

    // 404 for unmatched routes
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  },
});

console.log(`Server running on http://localhost:${config.port}`);

