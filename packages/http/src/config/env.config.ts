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

  const defaultTimeoutMs = parseOptionalInt("DEFAULT_TIMEOUT_MS", 10000);
  const port = parseOptionalInt("PORT", 3000);

  // Exa API configuration
  const exaApiKey = requireEnv("EXA_API_KEY");
  const exaBase = readEnv("EXA_BASE") ?? "https://api.exa.ai";

  // HasData API configuration
  const hasDataApiKey = requireEnv("HASDATA_API_KEY");
  const hasDataBase = readEnv("HASDATA_BASE") ?? "https://api.hasdata.com";

  // Storage configuration
  const responsesDir = readEnv("RESPONSES_DIR") ?? "responses";

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
  };
}

