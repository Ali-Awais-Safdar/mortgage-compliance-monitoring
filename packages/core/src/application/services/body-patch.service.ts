import type { CallWorkflowInput } from "@/application/dto/call-workflow.dto";
import {
  type JsonRecord,
  isJsonRecord,
  getValueAtPath,
  setAtPath,
  coercePreservingType,
} from "@/application/utils/json-path";
import { Result } from "@carbonteq/fp";
import type { AppError } from "@/application/errors/app-error";
import type { BoundingBox } from "@/domain/value-objects/bounding-box.vo";
import { parseBoundingBox } from "@/domain/value-objects/bounding-box.vo";
import { mapBoundingBoxErrorToAppError } from "@/application/utils/domain-error.mapper";

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

  public applyBaselineOverrides(body: JsonRecord, flags: CallWorkflowInput["flags"] = {}): Result<void, AppError> {
    if (!flags) {
      return Result.Ok(undefined);
    }

    const { staysSearchRequest, staysMapSearchRequestV2 } = this.ensureVariables(body);

    if (flags.bbox) {
      // For CLI calls: bbox might be a string, parse it if needed
      let bbox: BoundingBox;
      if (typeof flags.bbox === "string") {
        // Parse string bbox (for CLI calls) - return error if invalid
        const bboxResult = parseBoundingBox(flags.bbox);
        if (bboxResult.isErr()) {
          return Result.Err(mapBoundingBoxErrorToAppError(bboxResult.unwrapErr()));
        }
        bbox = bboxResult.unwrap();
      } else {
        bbox = flags.bbox;
      }

      const [neLat, neLng, swLat, swLng] = bbox;
      this.patchRawParams(body, "neLat", neLat);
      this.patchRawParams(body, "neLng", neLng);
      this.patchRawParams(body, "swLat", swLat);
      this.patchRawParams(body, "swLng", swLng);
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

    return Result.Ok(undefined);
  }

  public prepareBody(
    body: unknown,
    flags: CallWorkflowInput["flags"],
    overrides: Array<{ path: string; value: unknown }> = []
  ): Result<unknown, AppError> {
    if (!isJsonRecord(body)) {
      return Result.Ok(body);
    }

    if (flags) {
      const overrideResult = this.applyBaselineOverrides(body, flags);
      if (overrideResult.isErr()) {
        return overrideResult.map(() => body);
      }
    }

    for (const override of overrides) {
      this.applyBodyOverride(body, override.path, override.value);
    }

    return Result.Ok(body);
  }
}

