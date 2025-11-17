import type { Result } from "@carbonteq/fp";
import type { AppError } from "../errors/app-error";

export interface PropertyJsonFetchPort {
  fetchJson(url: string, timeoutMs?: number): Promise<Result<unknown, AppError>>;
}

