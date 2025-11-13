import { loadConfig } from "./config/env.config";
import { createContainer } from "./container";
import { registerPdpRoutes, type ServerContext } from "./routes/pdp.routes";

// Load configuration (validates env vars and fails fast if missing)
const config = loadConfig();

// Create dependency container
const container = createContainer(config);

// Create server context
const serverContext: ServerContext = {
  pdpController: {
    workflow: container.workflow,
    composer: container.composer,
    postprocess: container.postprocess,
    defaultTimeoutMs: container.defaultTimeoutMs,
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

