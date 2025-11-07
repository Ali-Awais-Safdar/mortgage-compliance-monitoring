import type { EncodingPort } from "../ports/encoding.port";

type JsonRecord = Record<string, unknown>;
type Indexable = JsonRecord | unknown[];
type IndexKey = string | number;

export class UrlPatchService {
  constructor(private readonly encoder: EncodingPort) {}

  private isJsonRecord(value: unknown): value is JsonRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private isIndexable(value: unknown): value is Indexable {
    return this.isJsonRecord(value) || Array.isArray(value);
  }

  private isArrayIndex(segment: string): boolean {
    return /^\d+$/.test(segment);
  }

  private toIndexKey(segment: string): IndexKey {
    return this.isArrayIndex(segment) ? Number.parseInt(segment, 10) : segment;
  }

  private readChild(container: Indexable, key: IndexKey): unknown {
    if (Array.isArray(container) && typeof key === "number") {
      return container[key];
    }

    if (!Array.isArray(container)) {
      return container[String(key)];
    }

    return undefined;
  }

  private writeChild(container: Indexable, key: IndexKey, value: unknown): void {
    if (Array.isArray(container) && typeof key === "number") {
      container[key] = value;
      return;
    }

    if (!Array.isArray(container)) {
      container[String(key)] = value;
    }
  }

  private ensureContainer(container: Indexable, key: IndexKey, nextSegment?: string): Indexable {
    const existing = this.readChild(container, key);
    if (this.isIndexable(existing)) {
      return existing;
    }

    const shouldBeArray = nextSegment ? this.isArrayIndex(nextSegment) : false;
    const nextValue: Indexable = shouldBeArray ? [] : {};
    this.writeChild(container, key, nextValue);
    return nextValue;
  }

  private getValueAtPath(target: Indexable, path: string): unknown {
    const segments = path.split(".").filter(Boolean);
    let current: unknown = target;

    for (const segment of segments) {
      if (!this.isIndexable(current)) {
        return undefined;
      }

      const key = this.toIndexKey(segment);
      current = this.readChild(current, key);
      if (current === undefined) {
        return undefined;
      }
    }

    return current;
  }

  public setAtPath(target: Indexable, path: string, value: unknown): void {
    const segments = path.split(".").filter(Boolean);
    if (segments.length === 0) {
      return;
    }

    let current: Indexable = target;

    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      if (!segment) {
        continue;
      }

      const key = this.toIndexKey(segment);
      const nextSegment = segments[i + 1];
      current = this.ensureContainer(current, key, nextSegment);
    }

    const finalSegment = segments[segments.length - 1];
    if (!finalSegment) {
      return;
    }

    const finalKey = this.toIndexKey(finalSegment);
    this.writeChild(current, finalKey, value);
  }

  private coercePreservingType(existingValue: unknown, provided: unknown): unknown {
    if (existingValue === undefined || existingValue === null) {
      return provided;
    }

    if (typeof existingValue === "string") {
      return String(provided);
    }

    if (typeof existingValue === "number") {
      const numberValue = typeof provided === "number" ? provided : Number.parseFloat(String(provided));
      if (!Number.isNaN(numberValue)) {
        return numberValue;
      }
    }

    return provided;
  }

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

    const existingLeaf = this.getValueAtPath(parsed, jsonPath);
    const finalValue = existingLeaf !== undefined ? this.coercePreservingType(existingLeaf, newValue) : newValue;

    this.setAtPath(parsed, jsonPath, finalValue);

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

