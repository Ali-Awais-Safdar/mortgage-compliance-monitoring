import { type HttpPort } from "@poc/core";
import type { ApiRequestDTO, ApiResponseDTO } from "@poc/core";
import { readEnv } from "../config/env";

export class FetchHttpAdapter implements HttpPort {
  async request<T = unknown>(input: ApiRequestDTO): Promise<ApiResponseDTO<T>> {
    const url = new URL(input.url);
    if (input.query) for (const [k, v] of Object.entries(input.query)) url.searchParams.set(k, String(v));

    const headers = new Headers();
    input.headers?.forEach((h: { name: string; value: string }) => headers.set(h.name, h.value));

    // inject API key from env if requested
    if (input.apiKeyName) {
      const key = readEnv(input.apiKeyName);
      if (key) headers.set("Authorization", headers.get("Authorization") ?? `Bearer ${key}`);
    }

    const controller = new AbortController();
    const timeout = input.timeoutMs ? setTimeout(() => controller.abort(), input.timeoutMs) : undefined;

    const res = await fetch(url, {
      method: input.method ?? "GET",
      headers,
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal
    }).finally(() => timeout && clearTimeout(timeout));

    const data = (await (res.headers.get("content-type")?.includes("json") ? res.json() : res.text())) as T;

    const out: ApiResponseDTO<T> = {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      data
    };
    return out;
  }
}
