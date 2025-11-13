import { readEnv } from "@poc/infra";

export interface HttpServerConfig {
  airbnbSearchUrl: string;
  airbnbUrl: string;
  airbnbSearchBody: unknown;
  apiKey: string;
  defaultTimeoutMs?: number;
  port: number;
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

  return {
    airbnbSearchUrl,
    airbnbUrl,
    airbnbSearchBody,
    apiKey,
    defaultTimeoutMs,
    port,
  };
}

