type AnyJson = unknown;

interface PdpSbuiBasicListItem {
  __typename?: string;
  title?: string;
  action?: unknown;
}

export class ResponsePostprocessService {
  private *walkJson(node: AnyJson): Generator<AnyJson> {
    if (node === null || node === undefined) {
      return;
    }

    if (Array.isArray(node)) {
      for (const value of node) {
        yield* this.walkJson(value);
      }
      return;
    }

    if (typeof node === "object") {
      yield node;
      for (const value of Object.values(node as Record<string, AnyJson>)) {
        yield* this.walkJson(value);
      }
    }
  }

  public collectHtmlText(root: AnyJson): string[] {
    const collected: string[] = [];

    for (const obj of this.walkJson(root)) {
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

    for (const obj of this.walkJson(root)) {
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

  public extractDerived<T>(responseBody: T): {
    htmlTexts: string[];
    pdpItems: Array<{ title?: string; action?: unknown }>;
  } {
    const htmlTexts = this.collectHtmlText(responseBody);
    const pdpItems = this.collectPdpSbuiBasicListItems(responseBody).map(({ title, action }) => ({
      title,
      action,
    }));

    return {
      htmlTexts,
      pdpItems,
    };
  }
}

