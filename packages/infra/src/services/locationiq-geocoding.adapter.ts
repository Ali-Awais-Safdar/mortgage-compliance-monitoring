import { Result } from "@carbonteq/fp";
import type { GeocodingPort, AppError, HttpPort } from "@poc/core";
import type { GeoPoint } from "@poc/core";
import { parseGeoPoint, mapGeoPointErrorToAppError } from "@poc/core";

export interface LocationIqConfig {
  baseUrl: string;
  apiKey: string;
  defaultTimeoutMs?: number;
}

export class LocationIqGeocodingAdapter implements GeocodingPort {
  constructor(
    private readonly http: HttpPort,
    private readonly config: LocationIqConfig
  ) {}

  async forwardGeocode(
    address: string,
    timeoutMs?: number
  ): Promise<Result<GeoPoint, AppError>> {
    const url = this.config.baseUrl;

    const response = await this.http.request<unknown>({
      url,
      method: "GET",
      query: {
        key: this.config.apiKey,
        q: address,
        format: "json",
      },
      timeoutMs: timeoutMs ?? this.config.defaultTimeoutMs,
    });

    if (response.isErr()) {
      return response;
    }

    const data = response.unwrap().data;

    // Validate that data is a non-empty array
    if (!Array.isArray(data) || data.length === 0) {
      return Result.Err({
        kind: "InvalidResponseError",
        message: "LocationIQ returned no results",
      });
    }

    // Take the first element's lat, lon fields
    const first = data[0] as { lat?: string; lon?: string };

    const lat = first.lat;
    const lon = first.lon;

    if (!lat || !lon) {
      return Result.Err({
        kind: "InvalidResponseError",
        message: "LocationIQ result missing lat/lon",
      });
    }

    // Parse and validate using domain function
    const geoPointRes = parseGeoPoint(lat, lon);
    return geoPointRes.mapErr(mapGeoPointErrorToAppError);
  }
}

