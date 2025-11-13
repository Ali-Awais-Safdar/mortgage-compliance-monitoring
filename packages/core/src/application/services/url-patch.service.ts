import type { EncodingPort } from "@/application/ports/encoding.port";
import {
  type JsonRecord,
  getValueAtPath,
  setAtPath,
  coercePreservingType,
} from "@/application/utils/json-path";

export class UrlPatchService {
  constructor(private readonly encoder: EncodingPort) {}

  public patchUrlJsonParam(
    url: URL,
    paramName: string,
    jsonPath: string,
    newValue: unknown
  ): void {
    const rawValue = url.searchParams.get(paramName);
    let parsed: JsonRecord = {};

    if (rawValue) {
      try {
        parsed = JSON.parse(rawValue) as JsonRecord;
      } catch {
        try {
          parsed = JSON.parse(decodeURIComponent(rawValue)) as JsonRecord;
        } catch {
          parsed = {};
        }
      }
    }

    const existingLeaf = getValueAtPath(parsed, jsonPath);
    const finalValue = existingLeaf !== undefined ? coercePreservingType(existingLeaf, newValue) : newValue;

    setAtPath(parsed, jsonPath, finalValue);

    url.searchParams.set(paramName, JSON.stringify(parsed));
  }

  public applyListingId(url: URL, listingId: string): void {
    const trimmedListingId = listingId.trim();
    if (!trimmedListingId) {
      return;
    }

    const stayId = this.encoder.base64(`StayListing:${trimmedListingId}`);
    const demandStayId = this.encoder.base64(`DemandStayListing:${trimmedListingId}`);

    this.patchUrlJsonParam(url, "variables", "id", stayId);
    this.patchUrlJsonParam(url, "variables", "demandStayListingId", demandStayId);
  }
}

