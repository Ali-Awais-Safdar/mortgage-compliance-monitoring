import type { CallWorkflowInput } from "../dto/call-workflow.dto";

type JsonRecord = Record<string, unknown>;
type Indexable = JsonRecord | unknown[];
type IndexKey = string | number;
type RawParam = { filterName: string; filterValues: string[] };

export class BodyPatchService {
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

  public coercePreservingType(existingValue: unknown, provided: unknown): unknown {
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

  private ensureVariables(body: JsonRecord): {
    staysSearchRequest: JsonRecord;
    staysMapSearchRequestV2: JsonRecord;
  } {
    if (!body.variables || !this.isJsonRecord(body.variables)) {
      body.variables = {};
    }

    const variables = body.variables as JsonRecord;

    if (!variables.staysSearchRequest || !this.isJsonRecord(variables.staysSearchRequest)) {
      variables.staysSearchRequest = {};
    }

    if (!variables.staysMapSearchRequestV2 || !this.isJsonRecord(variables.staysMapSearchRequestV2)) {
      variables.staysMapSearchRequestV2 = {};
    }

    return {
      staysSearchRequest: variables.staysSearchRequest as JsonRecord,
      staysMapSearchRequestV2: variables.staysMapSearchRequestV2 as JsonRecord,
    };
  }

  private ensureRawParams(container: JsonRecord): RawParam[] {
    const holder = container as { rawParams?: unknown };
    if (!Array.isArray(holder.rawParams)) {
      holder.rawParams = [];
    }

    return holder.rawParams as RawParam[];
  }

  public patchRawParams(body: JsonRecord, filterName: string, filterValue: unknown): void {
    const { staysSearchRequest, staysMapSearchRequestV2 } = this.ensureVariables(body);

    const searchRawParams = this.ensureRawParams(staysSearchRequest);
    const mapRawParams = this.ensureRawParams(staysMapSearchRequestV2);

    const updateFilter = (rawParams: RawParam[]) => {
      const existing = rawParams.find((item) => item.filterName === filterName);
      if (existing) {
        existing.filterValues = [String(filterValue)];
        return;
      }

      rawParams.push({ filterName, filterValues: [String(filterValue)] });
    };

    updateFilter(searchRawParams);
    updateFilter(mapRawParams);
  }

  public applyBodyOverride(body: JsonRecord, path: string, value: unknown): void {
    if (!path) {
      return;
    }

    if (
      path.startsWith("variables.staysSearchRequest.rawParams.") ||
      path.startsWith("variables.staysMapSearchRequestV2.rawParams.")
    ) {
      const rawParamsIndex = path.indexOf("rawParams.");
      if (rawParamsIndex !== -1) {
        const filterName = path.substring(rawParamsIndex + "rawParams.".length);
        this.patchRawParams(body, filterName, value);
        return;
      }
    }

    const existingLeaf = this.getValueAtPath(body, path);
    const finalValue = existingLeaf !== undefined ? this.coercePreservingType(existingLeaf, value) : value;
    this.setAtPath(body, path, finalValue);
  }

  public applyBaselineOverrides(body: JsonRecord, flags: CallWorkflowInput["flags"] = {}): void {
    if (!flags) {
      return;
    }

    const { staysSearchRequest, staysMapSearchRequestV2 } = this.ensureVariables(body);

    if (flags.bbox) {
      const segments = flags.bbox
        .split(",")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);

      if (segments.length !== 4) {
        throw new Error(`Invalid bbox format. Expected "neLat,neLng,swLat,swLng", got: ${flags.bbox}`);
      }

      const [neLat, neLng, swLat, swLng] = segments as [string, string, string, string];
      this.patchRawParams(body, "neLat", Number.parseFloat(neLat));
      this.patchRawParams(body, "neLng", Number.parseFloat(neLng));
      this.patchRawParams(body, "swLat", Number.parseFloat(swLat));
      this.patchRawParams(body, "swLng", Number.parseFloat(swLng));
    }

    if (flags.poiPlace) {
      this.patchRawParams(body, "placeId", flags.poiPlace);
    }

    if (flags.poiAcp) {
      this.patchRawParams(body, "acpId", flags.poiAcp);
    }

    if (flags.queryAddress) {
      this.patchRawParams(body, "query", flags.queryAddress);
    }

    this.patchRawParams(body, "refinementPaths", flags.refinementPath ?? "/homes");
    this.patchRawParams(body, "searchByMap", flags.searchByMap ?? true);
    this.patchRawParams(body, "searchType", "user_map_move");
    this.patchRawParams(body, "zoomLevel", flags.zoomLevel ?? 16);

    (staysSearchRequest as JsonRecord)["maxMapItems"] = 9999;
    (staysSearchRequest as JsonRecord)["skipHydrationListingIds"] = [] as string[];
    (staysMapSearchRequestV2 as JsonRecord)["skipHydrationListingIds"] = [] as string[];
  }

  public prepareBody(
    body: unknown,
    flags: CallWorkflowInput["flags"],
    overrides: Array<{ path: string; value: unknown }> = []
  ): unknown {
    if (!this.isJsonRecord(body)) {
      return body;
    }

    if (flags) {
      this.applyBaselineOverrides(body, flags);
    }

    for (const override of overrides) {
      this.applyBodyOverride(body, override.path, override.value);
    }

    return body;
  }
}

