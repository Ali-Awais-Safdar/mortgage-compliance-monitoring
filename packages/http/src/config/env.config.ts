import { readEnv } from "@poc/infra";

export interface HttpServerConfig {
  airbnbSearchUrl: string;
  airbnbUrl: string;
  airbnbSearchBody: unknown;
  apiKey: string;
  defaultTimeoutMs?: number;
  port: number;
  exaApiKey: string;
  exaBase: string;
  hasDataApiKey: string;
  hasDataBase: string;
  responsesDir: string;
  locationIqBase: string;
  locationIqKey: string;
  pdpMaxConcurrency: number;
  pdpMaxRetries: number;
  pdpBaseDelayMs: number;
  pdpJitterFactor: number;
  novadaProxyEnabled: boolean;
  novadaProxyHost?: string;
  novadaProxyPort?: number;
  novadaProxyUsername?: string;
  novadaProxyPassword?: string;
  novadaCountry?: string;
  novadaState?: string;
  novadaCity?: string;
  novadaAsn?: string;
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    console.error(`ERROR: ${name} environment variable is required`);
    process.exit(1);
  }
  return value;
}

function parseOptionalInt(name: string, defaultValue: number): number {
  const value = readEnv(name);
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return !Number.isNaN(parsed) ? parsed : defaultValue;
}

function parseOptionalBoolean(name: string, defaultValue: boolean): boolean {
  const value = readEnv(name);
  if (!value) return defaultValue;
  const normalized = value.toLowerCase().trim();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function loadConfig(): HttpServerConfig {
  const airbnbSearchUrl = requireEnv("AIRBNB_SEARCH_URL");
  const airbnbSearchBodyStr = requireEnv("AIRBNB_SEARCH_BODY");
  const airbnbUrl = requireEnv("AIRBNB_URL");
  const apiKey = requireEnv("AIRBNB_API_KEY");

  // Parse AIRBNB_SEARCH_BODY JSON
  let airbnbSearchBody: unknown;
  try {
    airbnbSearchBody = JSON.parse(airbnbSearchBodyStr);
  } catch {
    console.error("ERROR: AIRBNB_SEARCH_BODY must be valid JSON");
    process.exit(1);
  }

  const defaultTimeoutMs = parseOptionalInt("DEFAULT_TIMEOUT_MS", 20000);
  const port = parseOptionalInt("PORT", 3000);

  // Exa API configuration
  const exaApiKey = requireEnv("EXA_API_KEY");
  const exaBase = readEnv("EXA_BASE") ?? "https://api.exa.ai";

  // HasData API configuration
  const hasDataApiKey = requireEnv("HASDATA_API_KEY");
  const hasDataBase = readEnv("HASDATA_BASE") ?? "https://api.hasdata.com";

  // Storage configuration
  const responsesDir = readEnv("RESPONSES_DIR") ?? "responses";

  // LocationIQ configuration
  const locationIqBase = readEnv("LOCATIONIQ_BASE") ?? "https://us1.locationiq.com/v1/search";
  const locationIqKey = requireEnv("LOCATIONIQ_API_KEY");

  // PDP Batch Fetch configuration
  const pdpMaxConcurrency = parseOptionalInt("PDP_MAX_CONCURRENCY", 3);
  const pdpMaxRetries = parseOptionalInt("PDP_MAX_RETRIES", 4);
  const pdpBaseDelayMs = parseOptionalInt("PDP_BASE_DELAY_MS", 500);
  const pdpJitterFactorStr = readEnv("PDP_JITTER_FACTOR");
  let pdpJitterFactor = pdpJitterFactorStr
    ? Number.parseFloat(pdpJitterFactorStr)
    : 0.2;
  if (Number.isNaN(pdpJitterFactor) || pdpJitterFactor < 0 || pdpJitterFactor > 1) {
    console.warn(`WARNING: PDP_JITTER_FACTOR must be between 0 and 1, using default 0.2`);
    pdpJitterFactor = 0.2;
  }

  // Novada proxy configuration
  const novadaProxyEnabled = parseOptionalBoolean("NOVADA_PROXY_ENABLED", false);
  let novadaProxyHost: string | undefined;
  let novadaProxyPort: number | undefined;
  let novadaProxyUsername: string | undefined;
  let novadaProxyPassword: string | undefined;

  if (novadaProxyEnabled) {
    novadaProxyHost = requireEnv("NOVADA_PROXY_HOST");
    const portStr = requireEnv("NOVADA_PROXY_PORT");
    const port = Number.parseInt(portStr, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      console.error("ERROR: NOVADA_PROXY_PORT must be a valid port number (1-65535)");
      process.exit(1);
    }
    novadaProxyPort = port;
    novadaProxyUsername = requireEnv("NOVADA_PROXY_USERNAME");
    novadaProxyPassword = requireEnv("NOVADA_PROXY_PASSWORD");
  }

  // Optional Novada targeting parameters
  const novadaCountry = readEnv("NOVADA_COUNTRY");
  const novadaState = readEnv("NOVADA_STATE");
  const novadaCity = readEnv("NOVADA_CITY");
  const novadaAsn = readEnv("NOVADA_ASN");

  return {
    airbnbSearchUrl,
    airbnbUrl,
    airbnbSearchBody,
    apiKey,
    defaultTimeoutMs,
    port,
    exaApiKey,
    exaBase,
    hasDataApiKey,
    hasDataBase,
    responsesDir,
    locationIqBase,
    locationIqKey,
    pdpMaxConcurrency,
    pdpMaxRetries,
    pdpBaseDelayMs,
    pdpJitterFactor,
    novadaProxyEnabled,
    novadaProxyHost,
    novadaProxyPort,
    novadaProxyUsername,
    novadaProxyPassword,
    novadaCountry,
    novadaState,
    novadaCity,
    novadaAsn,
  };
}

