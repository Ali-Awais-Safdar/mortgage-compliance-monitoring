import type { BoundingBox } from "./bounding-box.vo";

export interface ResolvedSearchFlags {
  bbox: BoundingBox;
  zoomLevel?: number;
  queryAddress?: string;
  refinementPath?: string;
  searchByMap?: boolean;
  poiPlace?: string;
  poiAcp?: string;
}

