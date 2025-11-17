import { Result } from "@carbonteq/fp";
import type { PropertyJsonFetchPort, AppError, HttpPort } from "@poc/core";

export interface HasDataAdapterConfig {
  baseUrl: string; // e.g., https://api.hasdata.com
  apiKey: string;
  defaultTimeoutMs?: number;
}

export class HasDataAdapter implements PropertyJsonFetchPort {
  constructor(
    private readonly http: HttpPort,
    private readonly config: HasDataAdapterConfig
  ) {}

  async fetchJson(url: string, timeoutMs?: number): Promise<Result<unknown, AppError>> {
    const res = await this.http.request<unknown>({
      url: `${this.config.baseUrl}/scrape/redfin/property`,
      method: "GET",
      headers: [
        { name: "x-api-key", value: this.config.apiKey },
        { name: "content-type", value: "application/json" },
      ],
      query: { url },
      timeoutMs: timeoutMs ?? this.config.defaultTimeoutMs,
    });

    return res.map((r) => r.data);
  }
}

