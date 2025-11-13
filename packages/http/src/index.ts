import {
  GetPdpFromAddressWorkflow,
  PdpOutputComposer,
  SaveRedfinJsonFromAddressWorkflow,
  RedfinUrlFinderService,
} from "@poc/core";
import {
  StaticAddressResolverAdapter,
  createCoreWorkflow,
  ExaAdapter,
  FileStorageAdapter,
  FetchHttpAdapter,
} from "@poc/infra";
import { loadConfig } from "./config/env.config";
import { registerRoutes, type ServerContext } from "./routes/routes";

// Load configuration (validates env vars and fails fast if missing)
const config = loadConfig();

// Build dependencies using factory
const { callWorkflow, postprocess } = createCoreWorkflow();
const addressResolver = new StaticAddressResolverAdapter();

// Keep existing Airbnb wiring
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

// Build Redfin workflow dependencies
const exaHttp = new FetchHttpAdapter();
const exa = new ExaAdapter(
  { baseUrl: config.exaBase, apiKey: config.exaApiKey },
  exaHttp
);
const storage = new FileStorageAdapter(config.responsesDir);
const redfinFinder = new RedfinUrlFinderService(exa);
const redfinWorkflow = new SaveRedfinJsonFromAddressWorkflow(
  callWorkflow, // reused from createCoreWorkflow()
  redfinFinder,
  storage,
  {
    hasDataBase: config.hasDataBase,
    hasDataApiKey: config.hasDataApiKey,
    defaultTimeoutMs: config.defaultTimeoutMs,
  }
);

// Create server context
const serverContext: ServerContext = {
  pdpController: {
    workflow,
    composer,
    postprocess,
    defaultTimeoutMs: config.defaultTimeoutMs,
  },
  redfinController: {
    workflow: redfinWorkflow,
    defaultTimeoutMs: config.defaultTimeoutMs,
  },
};

// Start Bun server
console.log(`Starting server on port ${config.port}...`);

Bun.serve({
  port: config.port,
  async fetch(req: Request): Promise<Response> {
    const response = await registerRoutes(req, serverContext);
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

