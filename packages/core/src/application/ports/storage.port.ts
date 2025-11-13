import type { Result } from "@carbonteq/fp";
import type { AppError } from "../errors/app-error";

export interface StoragePort {
  saveJson(
    path: string,
    data: unknown
  ): Promise<Result<{ path: string; bytes: number }, AppError>>;
}

