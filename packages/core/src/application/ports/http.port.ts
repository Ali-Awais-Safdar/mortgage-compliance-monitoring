import type { ApiRequestDTO, ApiResponseDTO } from "../dto/request.dto";

export interface HttpPort {
  request<T = unknown>(input: ApiRequestDTO): Promise<ApiResponseDTO<T>>;
}

