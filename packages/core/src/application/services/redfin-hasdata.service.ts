import { CallExternalWorkflow } from "@/application/workflows/call-external.workflow";
import type { CallWorkflowInput } from "@/application/dto/call-workflow.dto";
import type { ApiResponseDTO } from "@/application/dto/request.dto";
import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";

export interface RedfinHasDataConfig {
  hasDataBase: string;
  hasDataApiKey: string;
  defaultTimeoutMs?: number;
}

export class RedfinHasDataService {
  constructor(
    private readonly callWorkflow: CallExternalWorkflow,
    private readonly config: RedfinHasDataConfig
  ) {}

  async fetch(url: string, timeoutMs?: number): Promise<Result<ApiResponseDTO<unknown>, AppError>> {
    const input = this.buildHasDataInput(url, timeoutMs);
    const result = await this.callWorkflow.execute<unknown>(input);
    
    // Extract the response from CallWorkflowResult
    return result.map((workflowResult) => workflowResult.response);
  }

  private buildHasDataInput(url: string, timeoutMs?: number): CallWorkflowInput {
    return {
      url: `${this.config.hasDataBase}/scrape/redfin/property`,
      method: "GET",
      headers: [
        { name: "x-api-key", value: this.config.hasDataApiKey },
        { name: "content-type", value: "application/json" },
      ],
      query: { url },
      timeoutMs: timeoutMs ?? this.config.defaultTimeoutMs,
    };
  }
}

