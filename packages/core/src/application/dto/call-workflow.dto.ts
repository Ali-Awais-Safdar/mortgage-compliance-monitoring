import type { ApiResponseDTO, Header } from "./request.dto";

export interface CallWorkflowInput {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Header[];
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  timeoutMs?: number;
  flags?: {
    listingId?: string;
    bbox?: string;
    poiPlace?: string;
    poiAcp?: string;
    queryAddress?: string;
    zoomLevel?: number;
    refinementPath?: string;
    searchByMap?: boolean;
  };
  overrides?: Array<{ path: string; value: unknown }>;
}

export interface CallWorkflowResult<T = unknown> {
  response: ApiResponseDTO<T>;
  derived?: {
    htmlTexts?: string[];
    pdpItems?: Array<{ title?: string; action?: unknown }>;
  };
}

