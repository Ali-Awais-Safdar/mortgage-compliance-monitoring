import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";
import type { GeocodingPort } from "@/application/ports/geocoding.port";
import type { ShortTermRentalProviderPort } from "@/application/ports/short-term-rental.port";
import type { BoundingBox } from "@/domain/value-objects/bounding-box.vo";
import type { GeoPoint } from "@/domain/value-objects/geo-point.vo";
import type { ResolvedSearchFlags, ViewportMeta } from "@/domain/value-objects/search-flags.vo";
import {
  bboxFromMeters,
  bboxFromZoom,
  type MeterBoxSpec,
  type ZoomViewportSpec,
} from "@/domain/utils/geo-bbox";
import { mapDomainErrorToAppError } from "@/application/utils/domain-error.mapper";

/**
 * Result type returned by DeterministicViewportSearchService.
 * Contains the listing IDs found, the bbox used, and metadata about how it was computed.
 */
export interface ListingsFromAddressResult {
  listingIds: string[];
  bbox: BoundingBox;
  viewportMeta: ViewportMeta;
}

/**
 * Service that implements the deterministic geocoding → bbox → listing search pipeline.
 * Implements a meters-based primary viewport with deterministic size, plus a meters-based expansion retry,
 * and a zoom-based fallback viewport.
 */
export class DeterministicViewportSearchService {
  // Primary meters-based viewport constants
  private static readonly PRIMARY_METERS_SPEC: MeterBoxSpec = {
    widthMeters: 350,
    heightMeters: 250,
    safetyMeters: 10,
  };

  // Retry scale factor for primary meters-based viewport
  private static readonly PRIMARY_RETRY_SCALE = 1.5;

  // Zoom level used for fallback and in search flags
  private static readonly ZOOM = 17;

  // Zoom-based fallback viewport constants
  private static readonly FALLBACK_ZOOM_SPEC: ZoomViewportSpec = {
    zoom: 17,
    widthPx: 400,
    heightPx: 300,
    safetyMeters: 10,
  };

  constructor(
    private readonly geocoding: GeocodingPort,
    private readonly shortTermProvider: ShortTermRentalProviderPort
  ) {}

  async findListingsFromAddress(
    address: string,
    timeoutMs?: number
  ): Promise<Result<ListingsFromAddressResult, AppError>> {
    // Step 1: Geocode the address
    const geocodeRes = await this.geocoding.forwardGeocode(address, timeoutMs);
    if (geocodeRes.isErr()) {
      return geocodeRes;
    }

    const center: GeoPoint = geocodeRes.unwrap();

    // Step 2: Primary meters-based viewport
    const primaryBboxRes = bboxFromMeters(center, DeterministicViewportSearchService.PRIMARY_METERS_SPEC)
      .mapErr(mapDomainErrorToAppError);

    if (primaryBboxRes.isErr()) {
      return primaryBboxRes;
    }

    const primaryBbox = primaryBboxRes.unwrap();
    const primaryIdsRes = await this.searchWithBBox(address, primaryBbox, timeoutMs);

    // Check if primary meters-based viewport succeeded and has listings
    if (primaryIdsRes.isOk()) {
      const primaryIds = primaryIdsRes.unwrap();
      if (primaryIds.length > 0) {
        return Result.Ok({
          listingIds: primaryIds,
          bbox: primaryBbox,
          viewportMeta: {
            strategy: "metersPrimary",
            widthMeters: DeterministicViewportSearchService.PRIMARY_METERS_SPEC.widthMeters,
            heightMeters: DeterministicViewportSearchService.PRIMARY_METERS_SPEC.heightMeters,
            safetyMeters: DeterministicViewportSearchService.PRIMARY_METERS_SPEC.safetyMeters,
          },
        });
      }
    }

    // Step 3: Primary meters-based retry with expanded size (only if primary succeeded but returned empty)
    const shouldRetryPrimary = primaryIdsRes.isOk() && primaryIdsRes.unwrap().length === 0;

    if (shouldRetryPrimary) {
      const retrySpec: MeterBoxSpec = {
        widthMeters: DeterministicViewportSearchService.PRIMARY_METERS_SPEC.widthMeters * DeterministicViewportSearchService.PRIMARY_RETRY_SCALE,
        heightMeters: DeterministicViewportSearchService.PRIMARY_METERS_SPEC.heightMeters * DeterministicViewportSearchService.PRIMARY_RETRY_SCALE,
        safetyMeters: DeterministicViewportSearchService.PRIMARY_METERS_SPEC.safetyMeters,
      };

      const retryBboxRes = bboxFromMeters(center, retrySpec)
        .mapErr(mapDomainErrorToAppError);

      if (retryBboxRes.isOk()) {
        const retryBbox = retryBboxRes.unwrap();
        const retryIdsRes = await this.searchWithBBox(address, retryBbox, timeoutMs);

        if (retryIdsRes.isOk()) {
          const retryIds = retryIdsRes.unwrap();
          if (retryIds.length > 0) {
            return Result.Ok({
              listingIds: retryIds,
              bbox: retryBbox,
              viewportMeta: {
                strategy: "metersPrimaryExpanded",
                widthMeters: retrySpec.widthMeters,
                heightMeters: retrySpec.heightMeters,
                safetyMeters: retrySpec.safetyMeters,
              },
            });
          }
        }
      }
    }

    // Step 4: Zoom-based fallback viewport
    const fallbackRes = bboxFromZoom(center, DeterministicViewportSearchService.FALLBACK_ZOOM_SPEC)
      .mapErr(mapDomainErrorToAppError);

    if (fallbackRes.isErr()) {
      return fallbackRes;
    }

    const { bbox: fallbackBbox, widthMeters, heightMeters } = fallbackRes.unwrap();

    // If fallback is smaller than primary, stop and return error
    if (
      widthMeters < DeterministicViewportSearchService.PRIMARY_METERS_SPEC.widthMeters ||
      heightMeters < DeterministicViewportSearchService.PRIMARY_METERS_SPEC.heightMeters
    ) {
      return Result.Err({
        kind: "InvalidResponseError",
        message: "Zoom-based fallback viewport is smaller than primary meters-based viewport; cannot proceed",
      } as AppError);
    }

    // Fallback bbox is large enough, use it directly
    const fallbackIdsRes = await this.searchWithBBox(address, fallbackBbox, timeoutMs);

    return fallbackIdsRes.flatMap((ids) => {
      if (ids.length === 0) {
        return Result.Err({
          kind: "InvalidResponseError",
          message: "No listingIds found after primary meters-based viewport, expanded retry, and zoom-based fallback",
        } as AppError);
      }

      return Result.Ok({
        listingIds: ids,
        bbox: fallbackBbox,
        viewportMeta: {
          strategy: "zoomFallback" as const,
          widthMeters,
          heightMeters,
          safetyMeters: DeterministicViewportSearchService.PRIMARY_METERS_SPEC.safetyMeters,
        },
      });
    });
  }

  /**
   * Helper method that builds ResolvedSearchFlags and calls the short-term rental provider.
   */
  private async searchWithBBox(
    address: string,
    bbox: BoundingBox,
    timeoutMs?: number
  ): Promise<Result<string[], AppError>> {
    const flags: ResolvedSearchFlags = {
      bbox,
      zoomLevel: DeterministicViewportSearchService.ZOOM,
      queryAddress: address,
      refinementPath: "/homes",
      searchByMap: true,
    };

    return this.shortTermProvider.findListingIds(flags, timeoutMs);
  }
}

