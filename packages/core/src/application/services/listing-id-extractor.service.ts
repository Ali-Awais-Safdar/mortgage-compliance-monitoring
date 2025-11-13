import { Option } from "@carbonteq/fp";
import { walkJson } from "@/application/utils/json-walk";

type AnyJson = unknown;

interface ExploreStayMapInfo {
  __typename?: string;
  listingId?: string | null;
}

export class ListingIdExtractorService {
  public extractFirstListingId(root: AnyJson): Option<string> {
    for (const obj of walkJson(root)) {
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        const candidate = (obj as Record<string, unknown>)["staysInViewport"];
        if (Array.isArray(candidate)) {
          for (const item of candidate) {
            if (item && typeof item === "object" && !Array.isArray(item)) {
              const mapInfo = item as ExploreStayMapInfo;
              if (mapInfo.listingId != null && typeof mapInfo.listingId === "string") {
                return Option.Some(mapInfo.listingId);
              }
            }
          }
        }
      }
    }

    return Option.None;
  }
}

