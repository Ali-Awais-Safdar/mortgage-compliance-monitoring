import {
  GetPdpFromAddressWorkflow,
  PdpJsonSerializer,
  SaveRedfinJsonFromAddressWorkflow,
  RedfinUrlFinderService,
  CompareListingsByAddressWorkflow,
  RedfinPropertyExtractor,
  MatchCalculator,
  AirbnbPdpExtractor,
  DeterministicViewportSearchService,
  PdpBatchFetchService,
} from "@poc/core";
import {
  createCoreWorkflow,
  WebSearchExaAdapter,
  AirbnbProviderAdapter,
  HasDataAdapter,
  FileStorageAdapter,
  FetchHttpAdapter,
  LocationIqGeocodingAdapter,
  NovadaProxyHttpAdapter,
  type NovadaProxyConfig,
} from "@poc/infra";
import { loadConfig } from "./config/env.config";
import { registerRoutes, type ServerContext } from "./routes/routes";

// Load configuration (validates env vars and fails fast if missing)
const config = loadConfig();

function buildNovadaProxyConfig(): NovadaProxyConfig {
  if (
    !config.novadaProxyHost ||
    !config.novadaProxyPort ||
    !config.novadaProxyUsername ||
    !config.novadaProxyPassword
  ) {
    throw new Error("Novada proxy is enabled but credentials are missing");
  }

  return {
    host: config.novadaProxyHost,
    port: config.novadaProxyPort,
    username: config.novadaProxyUsername,
    password: config.novadaProxyPassword,
    country: config.novadaCountry,
    state: config.novadaState,
    city: config.novadaCity,
    asn: config.novadaAsn,
  };
}

// Build outbound HTTP adapter (proxy-aware if enabled)
const novadaConfig = config.novadaProxyEnabled ? buildNovadaProxyConfig() : undefined;
const outboundHttp = novadaConfig ? new NovadaProxyHttpAdapter(novadaConfig) : new FetchHttpAdapter();

// Log proxy status for observability
if (config.novadaProxyEnabled) {
  console.log(
    `[Novada Proxy] Enabled - Host: ${config.novadaProxyHost}:${config.novadaProxyPort}, ` +
      `Targeting: ${[config.novadaCountry, config.novadaState, config.novadaCity, config.novadaAsn]
        .filter(Boolean)
        .join(", ") || "any location"}`
  );
} else {
  console.log("[Novada Proxy] Disabled - Using direct connections");
}

// Build dependencies using factory with proxy-aware HTTP adapter
const { callWorkflow, postprocess } = createCoreWorkflow({ http: outboundHttp });

// Instantiate HTTP adapter for LocationIQ
const httpAdapter = new FetchHttpAdapter();

// Instantiate LocationIQ geocoding adapter
const geocoder = new LocationIqGeocodingAdapter(httpAdapter, {
  baseUrl: config.locationIqBase,
  apiKey: config.locationIqKey,
  defaultTimeoutMs: config.defaultTimeoutMs,
});

// Instantiate Airbnb provider
const airbnbProvider = new AirbnbProviderAdapter(callWorkflow, {
  airbnbSearchUrl: config.airbnbSearchUrl,
  airbnbUrl: config.airbnbUrl,
  airbnbSearchBody: config.airbnbSearchBody,
  apiKey: config.apiKey,
  defaultTimeoutMs: config.defaultTimeoutMs,
});

// Instantiate deterministic viewport search service
const viewportSearch = new DeterministicViewportSearchService(
  geocoder,
  airbnbProvider
);

// Instantiate PDP batch fetch service with retry and concurrency control
const pdpBatchService = new PdpBatchFetchService(callWorkflow, {
  airbnbUrl: config.airbnbUrl,
  apiKey: config.apiKey,
  defaultTimeoutMs: config.defaultTimeoutMs,
  maxConcurrency: config.pdpMaxConcurrency,
  maxRetries: config.pdpMaxRetries,
  baseDelayMs: config.pdpBaseDelayMs,
  jitterFactor: config.pdpJitterFactor,
});

// Instantiate PDP workflow using deterministic viewport search
const workflow = new GetPdpFromAddressWorkflow(
  viewportSearch,
  pdpBatchService,
  {
    defaultTimeoutMs: config.defaultTimeoutMs,
  }
);

const serializer = new PdpJsonSerializer();

// Instantiate web search
const webSearch = new WebSearchExaAdapter(
  {
    baseUrl: config.exaBase,
    apiKey: config.exaApiKey,
    defaultTimeoutMs: config.defaultTimeoutMs,
  },
  new FetchHttpAdapter()
);

// Instantiate property content
const propertyContent = new HasDataAdapter(new FetchHttpAdapter(), {
  baseUrl: config.hasDataBase,
  apiKey: config.hasDataApiKey,
  defaultTimeoutMs: config.defaultTimeoutMs,
});

// Wire Redfin finder
const redfinFinder = new RedfinUrlFinderService(webSearch);

const storage = new FileStorageAdapter(config.responsesDir);

// Update redfin JSON workflow to use propertyContent
const redfinWorkflow = new SaveRedfinJsonFromAddressWorkflow(
  redfinFinder,
  propertyContent,
  storage
);

// Build compare workflow dependencies
const pdpExtractor = new AirbnbPdpExtractor(postprocess);
const redfinExtractor = new RedfinPropertyExtractor();
const matchCalculator = new MatchCalculator();

// Update compare workflow to use deterministic viewport search
const compareWorkflow = new CompareListingsByAddressWorkflow(
  viewportSearch,
  pdpBatchService,
  serializer,
  postprocess,
  {
    defaultTimeoutMs: config.defaultTimeoutMs,
  },
  pdpExtractor,
  redfinFinder,
  propertyContent,
  redfinExtractor,
  matchCalculator
);

// Create server context
const serverContext: ServerContext = {
  pdpController: {
    workflow,
    serializer,
    postprocess,
    defaultTimeoutMs: config.defaultTimeoutMs,
  },
  redfinController: {
    workflow: redfinWorkflow,
    defaultTimeoutMs: config.defaultTimeoutMs,
  },
  compareController: {
    workflow: compareWorkflow,
    defaultTimeoutMs: config.defaultTimeoutMs,
  },
};

// Start Bun server
console.log(`Starting server on port ${config.port}...`);

const defaultTimeoutMs = config.defaultTimeoutMs ?? 20000;

const idleTimeoutSeconds = Math.min(
  255,
  Math.ceil(defaultTimeoutMs / 1000) + 30, // small cushion
);

Bun.serve({
  port: config.port,
  idleTimeout: idleTimeoutSeconds,
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

