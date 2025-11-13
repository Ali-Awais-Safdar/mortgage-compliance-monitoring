import { ResponsePostprocessService } from "@/application/services/response-postprocess.service";

export interface PdpDerivedData {
  htmlTexts?: string[];
  pdpItems?: Array<{ title?: string; action?: unknown }>;
}

export class PdpOutputComposer {
  private formatPdpItems(items: Array<{ title?: string; action?: unknown }>): string {
    if (!items || items.length === 0) return "";

    const lines = ["=== PdpSbuiBasicListItem Details ==="];

    for (const item of items) {
      if (!item?.title) continue;

      lines.push(`- ${item.title}`);

      if (item.action !== null && item.action !== undefined) {
        lines.push(`  Action: ${JSON.stringify(item.action)}`);
      }
    }

    return lines.join("\n");
  }

  private joinCleanHtml(htmlTexts: string[], postprocess: ResponsePostprocessService): string {
    if (!htmlTexts || htmlTexts.length === 0) return "";

    const cleanedHtmlTexts = htmlTexts.map((html) => postprocess.cleanHtml(html));
    return cleanedHtmlTexts.join("\n\n---\n\n");
  }

  public compose(derived: PdpDerivedData, postprocess: ResponsePostprocessService): string {
    const outputParts: string[] = [];

    const formattedItems = this.formatPdpItems(derived.pdpItems ?? []);
    if (formattedItems) {
      outputParts.push(formattedItems);
    }

    const joinedHtml = this.joinCleanHtml(derived.htmlTexts ?? [], postprocess);
    if (joinedHtml) {
      outputParts.push(joinedHtml);
    }

    return outputParts.join("\n\n\n");
  }
}

