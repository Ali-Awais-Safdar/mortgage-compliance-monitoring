import { Result } from "@carbonteq/fp";
import type { AppError, ApiRequestDTO, ApiResponseDTO, HttpPort } from "@poc/core";
import { toAppError } from "../errors/error-adapter";

export class FetchHttpAdapter implements HttpPort {
  /**
   * Performs the actual HTTP fetch request. This method can be overridden
   * by subclasses to add proxy support or other custom behavior.
   */
  protected async doFetch(url: URL, init: RequestInit): Promise<Response> {
    return fetch(url, init);
  }

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

      const method = input.method ?? "GET";
      const body = method === "GET" ? undefined : (input.body ? JSON.stringify(input.body) : undefined);

      const res = await this.doFetch(url, {
        method,
        headers,
        body,
        signal: controller.signal
      }).finally(() => timeout && clearTimeout(timeout));

      if (res.status < 200 || res.status >= 300) {
        return Result.Err({
          kind: "InvalidResponseError",
          message: `HTTP ${res.status} ${res.statusText}`,
          statusCode: res.status,
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
