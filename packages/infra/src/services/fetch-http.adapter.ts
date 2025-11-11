import { Result } from "@carbonteq/fp";
import type { AppError, ApiRequestDTO, ApiResponseDTO, HttpPort } from "@poc/core";
import { toAppError } from "../errors/http-error.mapper";

export class FetchHttpAdapter implements HttpPort {
  async request<T = unknown>(input: ApiRequestDTO): Promise<Result<ApiResponseDTO<T>, AppError>> {
    try {
      const url = new URL(input.url);
      if (input.query) {
        for (const [k, v] of Object.entries(input.query)) {
          url.searchParams.set(k, String(v));
        }
      }

      const headers = new Headers();
      input.headers?.forEach((h: { name: string; value: string }) => headers.set(h.name, h.value));

      const controller = new AbortController();
      const timeout = input.timeoutMs ? setTimeout(() => controller.abort(), input.timeoutMs) : undefined;

      const res = await fetch(url, {
        method: input.method ?? "GET",
        headers,
        body: input.body ? JSON.stringify(input.body) : undefined,
        signal: controller.signal
      }).finally(() => timeout && clearTimeout(timeout));

      if (res.status < 200 || res.status >= 300) {
        return Result.Err({
          kind: "InvalidResponseError",
          message: `HTTP ${res.status} ${res.statusText}`,
        });
      }

      const hasNoContent = res.status === 204;
      const isJson = res.headers.get("content-type")?.includes("json");
      const data = hasNoContent ? (undefined as unknown as T) : ((await (isJson ? res.json() : res.text())) as T);

      return Result.Ok({
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        data
      });
    } catch (e) {
      return Result.Err(toAppError(e, { timeoutMs: input.timeoutMs }));
    }
  }
}
