import type { ApiRequestDTO, ApiResponseDTO } from "../dto/request.dto";
import type { HttpPort } from "../ports/http.port";

export class CallExternalWorkflow {
  constructor(private readonly http: HttpPort) {}

  async execute<T = unknown>(dto: ApiRequestDTO): Promise<ApiResponseDTO<T>> {

    return this.http.request<T>(dto);
  }
}
