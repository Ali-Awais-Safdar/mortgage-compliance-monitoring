import { CallExternalWorkflow, type ApiRequestDTO } from "@poc/core";
import { FetchHttpAdapter } from "@poc/infra";

export interface CallOptions {
  url: string;
  method?: string;
  header?: string[];
  query?: string[];
  data?: string;
  apiKeyName?: string;
  timeout?: number;
}

export const callHandler = async (opts: CallOptions) => {
  const headers = (opts.header ?? []).map((h) => {
    const [name, ...rest] = h.split(":");
    return { name: (name ?? "").trim(), value: rest.join(":").trim() };
  });

  const query = Object.fromEntries(
    (opts.query ?? []).map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v];
    })
  );

  const method = (opts.method?.toUpperCase() ?? "GET") as ApiRequestDTO["method"];

  const dto: ApiRequestDTO = {
    url: opts.url,
    method,
    headers,
    query,
    body: opts.data ? JSON.parse(opts.data) : undefined,
    apiKeyName: opts.apiKeyName,
    timeoutMs: opts.timeout
  };

  const wf = new CallExternalWorkflow(new FetchHttpAdapter());
  const res = await wf.execute(dto);
  console.log(JSON.stringify(res, null, 2));
};

