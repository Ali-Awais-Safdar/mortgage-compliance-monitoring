import type { CallWorkflowInput } from "@/application/dto/call-workflow.dto";

export interface PdpInputConfig {
  airbnbUrl: string;
  apiKey: string;
  defaultTimeoutMs?: number;
}

/**
 * Builds a CallWorkflowInput for PDP (Property Detail Page) requests.
 */
export function buildPdpInput(
  config: PdpInputConfig,
  listingId: string,
  timeoutMs?: number
): CallWorkflowInput {
  return {
    url: config.airbnbUrl,
    method: "GET",
    headers: [{ name: "x-airbnb-api-key", value: config.apiKey }],
    flags: {
      listingId,
    },
    timeoutMs: timeoutMs ?? config.defaultTimeoutMs,
  };
}

