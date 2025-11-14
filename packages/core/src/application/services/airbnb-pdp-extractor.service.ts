import { Option } from "@carbonteq/fp";
import type { PdpDerivedData } from "@/application/dto/pdp.dto";
import { ResponsePostprocessService } from "@/application/services/response-postprocess.service";

export interface ExtractedAirbnbData {
  bedrooms?: number;
  baths?: number;
}

export class AirbnbPdpExtractor {
  private readonly postprocess: ResponsePostprocessService;

  constructor() {
    this.postprocess = new ResponsePostprocessService();
  }

  /**
   * Extract bedrooms and baths from PDP derived data.
   * First tries to parse from pdpItems titles, then falls back to htmlTexts.
   */
  public extract(derived: PdpDerivedData): ExtractedAirbnbData {
    const bedroomsOpt = this.extractBedrooms(derived);
    const bathsOpt = this.extractBaths(derived);

    return {
      bedrooms: bedroomsOpt.isSome() ? bedroomsOpt.unwrap() : undefined,
      baths: bathsOpt.isSome() ? bathsOpt.unwrap() : undefined,
    };
  }

  private extractBedrooms(derived: PdpDerivedData): Option<number> {
    // Try pdpItems first
    const fromItems = this.parseFromItems(derived.pdpItems ?? [], /(\d+(?:\.\d+)?)\s*bedrooms?/i);
    if (fromItems.isSome()) {
      return fromItems;
    }

    // Fallback to htmlTexts
    return this.parseFromHtmlTexts(derived.htmlTexts ?? [], /(\d+(?:\.\d+)?)\s*bedrooms?/i);
  }

  private extractBaths(derived: PdpDerivedData): Option<number> {
    // Try pdpItems first
    const fromItems = this.parseFromItems(derived.pdpItems ?? [], /(\d+(?:\.\d+)?)\s*baths?/i);
    if (fromItems.isSome()) {
      return fromItems;
    }

    // Fallback to htmlTexts
    return this.parseFromHtmlTexts(derived.htmlTexts ?? [], /(\d+(?:\.\d+)?)\s*baths?/i);
  }

  private parseFromItems(
    items: Array<{ title?: string; action?: unknown }>,
    regex: RegExp
  ): Option<number> {
    for (const item of items) {
      if (item.title) {
        const match = regex.exec(item.title);
        if (match && match[1]) {
          const value = Number.parseFloat(match[1]);
          if (!Number.isNaN(value)) {
            return Option.Some(value);
          }
        }
      }
    }
    return Option.None;
  }

  private parseFromHtmlTexts(htmlTexts: string[], regex: RegExp): Option<number> {
    for (const htmlText of htmlTexts) {
      // Clean HTML to plain text for better parsing
      const cleaned = this.postprocess.cleanHtml(htmlText);
      const match = regex.exec(cleaned);
      if (match && match[1]) {
        const value = Number.parseFloat(match[1]);
        if (!Number.isNaN(value)) {
          return Option.Some(value);
        }
      }
    }
    return Option.None;
  }
}

