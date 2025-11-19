import { Result, Option } from "@carbonteq/fp";
import type { WebSearchPort, SearchMode, SearchResultItem, PageAddress } from "@poc/core";
import type { HttpPort } from "@poc/core";
import type { AppError } from "@poc/core";

export interface WebSearchExaAdapterConfig {
  baseUrl: string;
  apiKey: string;
  defaultTimeoutMs?: number;
}

export class WebSearchExaAdapter implements WebSearchPort {
  constructor(
    private readonly config: WebSearchExaAdapterConfig,
    private readonly http: HttpPort
  ) {}

  async search(input: {
    query: string;
    mode: SearchMode;
    numResults?: number;
    includeDomains?: string[];
    timeoutMs?: number;
  }): Promise<Result<{ results: SearchResultItem[] }, AppError>> {
    // Map SearchMode to Exa type
    const exaType = input.mode === "exact" ? "keyword" : "auto";

    const body = {
      query: input.query,
      type: exaType,
      numResults: input.numResults ?? 10,
      includeDomains: input.includeDomains ?? ["redfin.com"],
      text: false,
    };

    const response = await this.http.request<{
      results?: Array<{ url?: string; id?: string }>;
    }>({
      url: `${this.config.baseUrl}/search`,
      method: "POST",
      headers: [
        { name: "x-api-key", value: this.config.apiKey },
        { name: "content-type", value: "application/json" },
      ],
      body,
      timeoutMs: input.timeoutMs,
    });

    if (response.isErr()) {
      const err = response.unwrapErr();
      console.error("[Exa search] error", { query: input.query, mode: input.mode, kind: err.kind, message: err.message });
      return response;
    }

    const data = response.unwrap().data;
    if (!data || typeof data !== "object") {
      return Result.Err({
        kind: "InvalidResponseError",
        message: "Invalid response format from Exa API",
      } as AppError);
    }

    // Map Exa results to SearchResultItem (only url, not id)
    const results: SearchResultItem[] = (data.results ?? [])
      .map((item) => item.url ?? item.id)
      .filter((url): url is string => url != null && url.length > 0)
      .map((url) => ({ url }));

    return Result.Ok({
      results,
    });
  }

  async fetchPageAddress(url: string): Promise<Result<Option<PageAddress>, AppError>> {
    const body = {
      urls: [url],
      text: false,
      livecrawl: "preferred",
      summary: {
        query: "Extract page address object if present",
        schema: {
          type: "object",
          properties: {
            streetAddress: { type: "string" },
            addressLocality: { type: "string" },
            addressRegion: { type: "string" },
            postalCode: { type: "string" },
          },
        },
      },
    };

    const response = await this.http.request<{
      statuses?: Array<{ status?: string }>;
      results?: Array<{ summary?: string | PageAddress }>;
    }>({
      url: `${this.config.baseUrl}/contents`,
      method: "POST",
      headers: [
        { name: "x-api-key", value: this.config.apiKey },
        { name: "content-type", value: "application/json" },
      ],
      body,
      timeoutMs: this.config.defaultTimeoutMs,
    });

    if (response.isErr()) {
      const err = response.unwrapErr();
      console.error("[Exa fetchPageAddress] error", { url, kind: err.kind, message: err.message });
      return response;
    }

    const data = response.unwrap().data;
    if (!data || typeof data !== "object") {
      return Result.Ok(Option.None);
    }

    const statuses = data.statuses ?? [];
    if (statuses.length === 0 || statuses[0]?.status !== "success") {
      return Result.Ok(Option.None);
    }

    const results = data.results ?? [];
    if (results.length === 0) {
      return Result.Ok(Option.None);
    }

    const result = results[0];
    if (!result) {
      return Result.Ok(Option.None);
    }

    const summary = result.summary;

    if (!summary) {
      return Result.Ok(Option.None);
    }

    try {
      let pageAddress: PageAddress | null = null;

      if (typeof summary === "string") {
        pageAddress = JSON.parse(summary) as PageAddress;
      } else if (typeof summary === "object") {
        pageAddress = summary as PageAddress;
      }

      if (pageAddress && typeof pageAddress === "object") {
        return Result.Ok(Option.Some({
          streetAddress: pageAddress.streetAddress,
          addressLocality: pageAddress.addressLocality,
          addressRegion: pageAddress.addressRegion,
          postalCode: pageAddress.postalCode,
        }));
      }

      return Result.Ok(Option.None);
    } catch {
      return Result.Ok(Option.None);
    }
  }
}

