import { Result } from "@carbonteq/fp";
import type { StoragePort } from "@poc/core";
import type { AppError } from "@poc/core";
import { toAppError } from "../errors/error-adapter";
import { mkdir } from "fs/promises";
import { dirname } from "path";

export class FileStorageAdapter implements StoragePort {
  constructor(private readonly baseDir: string) {}

  async saveJson(
    path: string,
    data: unknown
  ): Promise<Result<{ path: string; bytes: number }, AppError>> {
    try {
      // Resolve full path (handle relative paths)
      const fullPath = path.startsWith("/") ? path : `${this.baseDir}/${path}`;
      const dir = dirname(fullPath);

      // Ensure directory exists (mkdir -p semantics)
      await mkdir(dir, { recursive: true });

      // Write pretty JSON
      const jsonString = JSON.stringify(data, null, 2);
      const encoder = new TextEncoder();
      const bytes = encoder.encode(jsonString).length;

      await Bun.write(fullPath, jsonString);

      return Result.Ok({
        path: fullPath,
        bytes,
      });
    } catch (e) {
      return Result.Err(toAppError(e));
    }
  }
}

