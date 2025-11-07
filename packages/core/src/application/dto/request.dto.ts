export type Header = { name: string; value: string };

export interface ApiRequestDTO {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Header[];
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  timeoutMs?: number;
}

export interface ApiResponseDTO<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
}
