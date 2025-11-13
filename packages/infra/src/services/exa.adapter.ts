import { Result, Option } from "@carbonteq/fp";
import type { ExaPort, ExaSearchResult, PageAddress, ExaSearchType } from "@poc/core";
import type { HttpPort } from "@poc/core";
import type { AppError } from "@poc/core";

export interface ExaAdapterConfig {
  baseUrl: string;
  apiKey: string;
}

export class ExaAdapter implements ExaPort {
  constructor(
    private readonly config: ExaAdapterConfig,
    private readonly http: HttpPort
  ) {}

  async search(params: {
    query: string;
    type: ExaSearchType;
    numResults?: number;
    includeDomains?: string[];
  }): Promise<Result<ExaSearchResult, AppError>> {
    const body = {
      query: params.query,
      type: params.type,
      numResults: params.numResults ?? 10,
      includeDomains: params.includeDomains ?? ["redfin.com"],
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
    });

    if (response.isErr()) {
      return response;
    }

    const data = response.unwrap().data;
    if (!data || typeof data !== "object") {
      return Result.Err({
        kind: "InvalidResponseError",
        message: "Invalid response format from Exa API",
      } as AppError);
    }

    return Result.Ok({
      results: data.results ?? [],
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
      timeoutMs: 90000, // 90 seconds as per Python code
    });

    if (response.isErr()) {
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

