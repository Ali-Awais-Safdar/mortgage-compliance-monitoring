import { walkJson } from "@/domain/utils/json-walk";

type AnyJson = unknown;

interface PdpSbuiBasicListItem {
  __typename?: string;
  title?: string;
  action?: unknown;
}

export class ResponsePostprocessService {
  public collectHtmlText(root: AnyJson): string[] {
    const collected: string[] = [];

    for (const obj of walkJson(root)) {
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        const candidate = (obj as Record<string, unknown>)["htmlText"];
        if (typeof candidate === "string") {
          collected.push(candidate);
        }
      }
    }

    return Array.from(new Set(collected));
  }

  public collectPdpSbuiBasicListItems(root: AnyJson): PdpSbuiBasicListItem[] {
    const items: PdpSbuiBasicListItem[] = [];

    for (const obj of walkJson(root)) {
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        const typed = obj as Record<string, unknown>;
        if (typed.__typename === "PdpSbuiBasicListItem") {
          items.push({
            __typename: typeof typed.__typename === "string" ? typed.__typename : undefined,
            title: typeof typed.title === "string" ? typed.title : undefined,
            action: typed.action,
          });
        }
      }
    }

    return items;
  }

  public cleanHtml(input: string): string {
    let result = input;

    result = result.replace(/<\s*br\s*\/?>(?=\s|$)/gi, "\n");
    result = result.replace(/<\s*\/\s*(p|div|h[1-6]|li|ul|ol|table|tr|th|td)\s*>/gi, "\n");
    result = result.replace(/<\s*(p|div|h[1-6]|li|ul|ol|table|tr)\b[^>]*>/gi, "\n");

    result = result.replace(/<\/?[^>]+>/g, "");

    const entities: Record<string, string> = {
      "&nbsp;": " ",
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": "\"",
      "&#39;": "'",
      "&#x27;": "'",
      "&#x2F;": "/",
      "&#47;": "/",
    };

    result = result.replace(/&[a-zA-Z#0-9]+;?/g, (match) => entities[match] ?? match);

    result = result.replace(/[ \t]+\n/g, "\n");
    result = result.replace(/\n{3,}/g, "\n\n");
    result = result.replace(/[ \t]{2,}/g, " ");
    result = result.trim();

    return result;
  }

  private extractLocationCoordinates(root: AnyJson): { lat?: number; lng?: number } {
    for (const obj of walkJson(root)) {
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        const typed = obj as Record<string, unknown>;
        if (typed.__typename === "LocationSection") {
          const lat = typed.lat;
          const lng = typed.lng;

          // Validate that both lat and lng are numeric
          if (
            typeof lat === "number" &&
            !Number.isNaN(lat) &&
            typeof lng === "number" &&
            !Number.isNaN(lng)
          ) {
            return { lat, lng };
          }
        }
      }
    }

    return {};
  }

  public extractDerived<T>(responseBody: T): {
    htmlTexts: string[];
    pdpItems: Array<{ title?: string; action?: unknown }>;
    lat?: number;
    lng?: number;
  } {
    const htmlTexts = this.collectHtmlText(responseBody);
    const pdpItems = this.collectPdpSbuiBasicListItems(responseBody).map(({ title, action }) => ({
      title,
      action,
    }));
    const { lat, lng } = this.extractLocationCoordinates(responseBody);

    return {
      htmlTexts,
      pdpItems,
      lat,
      lng,
    };
  }
}

