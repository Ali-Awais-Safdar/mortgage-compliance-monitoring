import type { BoundingBox } from "./bounding-box.vo";

/**
 * Metadata about how a viewport/bbox was computed.
 * Useful for debugging and auditability.
 */
export interface ViewportMeta {
  strategy: "metersPrimary" | "metersPrimaryExpanded" | "zoomFallback";
  widthMeters: number;
  heightMeters: number;
  safetyMeters: number;
}

export interface ResolvedSearchFlags {
  bbox: BoundingBox;
  zoomLevel?: number;
  queryAddress?: string;
  refinementPath?: string;
  searchByMap?: boolean;
  poiPlace?: string;
  poiAcp?: string;
}

