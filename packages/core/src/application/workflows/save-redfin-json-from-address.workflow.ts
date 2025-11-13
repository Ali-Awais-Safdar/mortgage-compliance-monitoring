import type { CallWorkflowInput, CallWorkflowResult } from "@/application/dto/call-workflow.dto";
import { CallExternalWorkflow } from "@/application/workflows/call-external.workflow";
import { RedfinUrlFinderService } from "@/application/services/redfin-url-finder.service";
import type { StoragePort } from "@/application/ports/storage.port";
import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";

export interface SaveRedfinJsonFromAddressConfig {
  hasDataBase: string;
  hasDataApiKey: string;
  defaultTimeoutMs?: number;
}

export interface SaveRedfinJsonFromAddressInput {
  address: string;
  timeoutMs?: number;
}

export interface SaveRedfinJsonFromAddressResult {
  url: string;
  savedPath: string;
}

export class SaveRedfinJsonFromAddressWorkflow {
  constructor(
    private readonly callWorkflow: CallExternalWorkflow,
    private readonly redfinUrlFinder: RedfinUrlFinderService,
    private readonly storage: StoragePort,
    private readonly config: SaveRedfinJsonFromAddressConfig
  ) {}

  /**
   * Generates a safe ID for the filename from the response data or URL.
   * Priority: property.propertyId > numeric ID from URL > hash of URL
   */
  private generateSafeId(responseData: unknown, url: string): string {
    // Try to extract property.propertyId from response data
    if (responseData && typeof responseData === "object") {
      const data = responseData as Record<string, unknown>;
      const property = data.property;
      if (property && typeof property === "object") {
        const propertyObj = property as Record<string, unknown>;
        const propertyId = propertyObj.propertyId;
        if (propertyId && (typeof propertyId === "string" || typeof propertyId === "number")) {
          return String(propertyId);
        }
      }
    }

    // Try to extract numeric ID from URL (/home/<digits>)
    const urlMatch = url.match(/\/home\/(\d+)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }

    // Fallback: generate a short hash from URL
    // Simple hash function (FNV-1a inspired)
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
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

  async execute(
    input: SaveRedfinJsonFromAddressInput
  ): Promise<Result<SaveRedfinJsonFromAddressResult, AppError>> {
    const address = input.address.trim();
    const timeoutMs = input.timeoutMs ?? this.config.defaultTimeoutMs;

    return Result.Ok(address)
      .validate([
        (addr: string) => {
          if (!addr || addr.length === 0) {
            return Result.Err({
              kind: "InvalidInputError",
              message: "Address cannot be empty",
            } as AppError);
          }
          return Result.Ok(addr);
        },
      ])
      .mapErr((errs: AppError | AppError[]) => {
        const fallback = "Invalid address";
        if (Array.isArray(errs)) {
          return errs
            .map((e) => e.message ?? fallback)
            .join("; ");
        }
        return errs.message ?? fallback;
      })
      .mapErr((message) => ({ kind: "InvalidInputError", message } as AppError))
      .flatMap(async (addr: string) => {
        // Find Redfin URL - short-circuits if not found
        return await this.redfinUrlFinder.findRedfinUrlForAddress(addr);
      })
      .flatMap(async (url: string) => {
        // Call HasData API
        const hasDataInput = this.buildHasDataInput(url, timeoutMs);
        const result = await this.callWorkflow.execute<unknown>(hasDataInput);
        
        // Use zip to combine URL with result
        return result.map((res) => ({ url, result: res }));
      })
      .flatMap(async ({ url, result }: { url: string; result: CallWorkflowResult<unknown> }) => {
        // Generate safe ID and save JSON
        const safeId = this.generateSafeId(result.response.data, url);
        // Only pass filename - FileStorageAdapter will prepend baseDir
        const path = `redfin_${safeId}.json`;
        
        const saveResult = await this.storage.saveJson(path, result.response.data);
        
        return saveResult.map((saved) => ({
          url,
          savedPath: saved.path,
        }));
      })
      .toPromise();
  }
}

