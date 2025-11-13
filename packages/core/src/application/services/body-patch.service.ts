import type { CallWorkflowInput } from "@/application/dto/call-workflow.dto";
import {
  type JsonRecord,
  isJsonRecord,
  getValueAtPath,
  setAtPath,
  coercePreservingType,
} from "@/application/utils/json-path";

type RawParam = { filterName: string; filterValues: string[] };

export class BodyPatchService {

  private ensureVariables(body: JsonRecord): {
    staysSearchRequest: JsonRecord;
    staysMapSearchRequestV2: JsonRecord;
  } {
    if (!body.variables || !isJsonRecord(body.variables)) {
      body.variables = {};
    }

    const variables = body.variables as JsonRecord;

    if (!variables.staysSearchRequest || !isJsonRecord(variables.staysSearchRequest)) {
      variables.staysSearchRequest = {};
    }

    if (!variables.staysMapSearchRequestV2 || !isJsonRecord(variables.staysMapSearchRequestV2)) {
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

    const existingLeaf = getValueAtPath(body, path);
    const finalValue = existingLeaf !== undefined ? coercePreservingType(existingLeaf, value) : value;
    setAtPath(body, path, finalValue);
  }

  public applyBaselineOverrides(body: JsonRecord, flags: CallWorkflowInput["flags"] = {}): void {
    if (!flags) {
      return;
    }

    const { staysSearchRequest, staysMapSearchRequestV2 } = this.ensureVariables(body);

    if (flags.bbox) {
      const segments = flags.bbox
        .split(",")
        .map((segment: string) => segment.trim())
        .filter((segment: string) => segment.length > 0);

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
    if (!isJsonRecord(body)) {
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

