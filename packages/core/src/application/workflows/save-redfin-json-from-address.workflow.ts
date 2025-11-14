import { RedfinUrlFinderService } from "@/application/services/redfin-url-finder.service";
import { RedfinHasDataService } from "@/application/services/redfin-hasdata.service";
import type { StoragePort } from "@/application/ports/storage.port";
import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";

export interface SaveRedfinJsonFromAddressConfig {
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
    private readonly redfinUrlFinder: RedfinUrlFinderService,
    private readonly hasDataService: RedfinHasDataService,
    private readonly storage: StoragePort,
    private readonly config: SaveRedfinJsonFromAddressConfig
  ) {}

  private deriveCitySlugFromAddress(address: string): string | null {
    const seg = address.split(",")[1]?.trim();
    if (!seg) return null;
    const slug = seg.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return slug || null;
  }

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

    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
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
        const urlResult = await this.redfinUrlFinder.findRedfinUrlForAddress(addr);
        return urlResult.map((url) => ({ url, address: addr }));
      })
      .flatMap(async ({ url, address }: { url: string; address: string }) => {
        // Call HasData API via service
        const responseResult = await this.hasDataService.fetch(url, timeoutMs);
        
        // Directly use response data without artificial CallWorkflowResult shape
        return responseResult.map((response) => ({
          url,
          address,
          responseData: response.data,
        }));
      })
      .flatMap(async ({ url, address, responseData }: { url: string; address: string; responseData: unknown }) => {
        // Generate city slug or fallback to safe ID
        const slug = this.deriveCitySlugFromAddress(address);
        const safeId = this.generateSafeId(responseData, url);
        // Only pass filename - FileStorageAdapter will prepend baseDir
        const path = slug ? `redfin_${slug}.json` : `redfin_${safeId}.json`;
        
        const saveResult = await this.storage.saveJson(path, responseData);
        
        return saveResult.map((saved) => ({
          url,
          savedPath: saved.path,
        }));
      })
      .toPromise();
  }
}

