import type { Result } from "@carbonteq/fp";
import type { AppError } from "../errors/app-error";
import type { ApiRequestDTO, ApiResponseDTO } from "../dto/request.dto";

export interface HttpPort {
  /**
   * Executes an HTTP request.
   *
   * Implementations MUST return `Result.Err` with `InvalidResponseError` for any non-2xx status,
   * reserving `Result.Ok` exclusively for successful transport responses.
   */
  request<T = unknown>(input: ApiRequestDTO): Promise<Result<ApiResponseDTO<T>, AppError>>;
}

