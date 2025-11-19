import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";
import type { CallExternalWorkflow } from "@/application/workflows/call-external.workflow";
import type { PdpDerivedData } from "@/domain/value-objects/pdp-derived.vo";
import { buildPdpInput, type PdpInputConfig } from "@/application/services/pdp-input.builder";
import { aggregateErrorsToInvalidResponse } from "@/application/utils/app-error.helpers";

export interface PdpBatchFetchConfig extends PdpInputConfig {
  maxConcurrency: number;
  maxRetries: number;
  baseDelayMs: number;
  jitterFactor?: number;
}

export class PdpBatchFetchService {
  constructor(
    private readonly callWorkflow: CallExternalWorkflow,
    private readonly config: PdpBatchFetchConfig
  ) {}

  async fetchDerivedForListingIds(
    listingIds: string[],
    timeoutMs?: number
  ): Promise<Result<PdpDerivedData[], AppError>> {
    if (listingIds.length === 0) {
      return Result.Ok([]);
    }

    const results: Array<Result<PdpDerivedData, AppError>> = new Array(listingIds.length);
    let index = 0;

    // Create worker function that processes items from the queue
    const worker = async (): Promise<void> => {
      while (index < listingIds.length) {
        const currentIndex = index++;
        const listingId = listingIds[currentIndex];
        if (listingId === undefined) {
          // This should never happen, but TypeScript needs the check
          continue;
        }
        results[currentIndex] = await this.fetchSingleWithRetry(listingId, timeoutMs);
      }
    };

    // Start workers up to maxConcurrency
    const workers = Array.from(
      { length: Math.min(this.config.maxConcurrency, listingIds.length) },
      () => worker()
    );

    // Wait for all workers to complete
    await Promise.all(workers);

    // Aggregate results using Result.all
    const aggregated = Result.all(...results);
    return aggregated.mapErr(aggregateErrorsToInvalidResponse);
  }

  private async fetchSingleWithRetry(
    listingId: string,
    timeoutMs?: number
  ): Promise<Result<PdpDerivedData, AppError>> {
    const pdpInput = buildPdpInput(this.config, listingId, timeoutMs);
    let lastErr: AppError | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const res = await this.callWorkflow.execute<unknown>(pdpInput);

      if (res.isOk()) {
        const wf = res.unwrap();
        const htmlTexts = wf.derived?.htmlTexts ?? [];
        const pdpItems = wf.derived?.pdpItems ?? [];
        const derived: PdpDerivedData = {
          htmlTexts,
          pdpItems,
          listingId,
          lat: wf.derived?.lat,
          lng: wf.derived?.lng,
        };
        return Result.Ok(derived);
      }

      const err = res.unwrapErr();
      lastErr = err;

      if (!this.isTransientError(err) || attempt === this.config.maxRetries) {
        break;
      }

      const delay = this.computeBackoffDelay(attempt);
      await this.sleep(delay);
    }

    return Result.Err(
      lastErr ?? {
        kind: "InvalidResponseError",
        message: `Unknown PDP error for listingId=${listingId}`,
      }
    );
  }

  private isTransientError(err: AppError): boolean {
    // Timeouts are always transient
    if (err.kind === "TimeoutError") {
      return true;
    }

    // Transport errors (network failures) are transient
    if (err.kind === "TransportError") {
      return true;
    }

    // Rate limiting (429) is transient
    if (err.kind === "InvalidResponseError" && err.statusCode === 429) {
      return true;
    }

    return false;
  }

  private computeBackoffDelay(attempt: number): number {
    // Exponential backoff: base * 2^(attempt-1)
    const exponential = this.config.baseDelayMs * Math.pow(2, attempt - 1);

    // Add jitter: ±(jitterFactor * exponential)
    const jitter = exponential * (this.config.jitterFactor ?? 0.1);
    const min = exponential - jitter;
    const max = exponential + jitter;

    // Ensure minimum delay of 100ms
    return Math.max(100, Math.floor(min + Math.random() * (max - min)));
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

