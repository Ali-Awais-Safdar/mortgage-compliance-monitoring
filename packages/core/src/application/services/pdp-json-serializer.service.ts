import type { PdpDerivedData, PdpListingDetailsDTO } from "@/application/dto/pdp.dto";
import { ResponsePostprocessService } from "@/application/services/response-postprocess.service";

/**
 * Serializes PDP derived data into structured JSON format.
 * Single, reusable formatting point for HTTP and CLI presentation layers.
 * 
 * Extracts guests, bedrooms, beds, baths from pdpItems titles.
 * Builds description from cleaned and concatenated htmlTexts.
 * Includes lat/lng coordinates if available.
 */
export class PdpJsonSerializer {
  public serialize(derived: PdpDerivedData, postprocess: ResponsePostprocessService): PdpListingDetailsDTO {
    // Extract guests, bedrooms, beds, baths from pdpItems titles
    const guests = this.extractFromItems(derived.pdpItems ?? [], /^(\d+\+?\s*guests?)$/i);
    const bedrooms = this.extractFromItems(derived.pdpItems ?? [], /^(\d+(?:\.\d+)?\s*bedrooms?)$/i);
    const beds = this.extractFromItems(derived.pdpItems ?? [], /^(\d+(?:\.\d+)?\s*beds?)$/i);
    const baths = this.extractFromItems(derived.pdpItems ?? [], /^(\d+(?:\.\d+)?\s*baths?)$/i);

    // Build description by cleaning all htmlTexts and concatenating
    const descriptionParts = (derived.htmlTexts ?? [])
      .map((html: string) => postprocess.cleanHtml(html))
      .filter((cleaned: string) => cleaned.length > 0);

    const description = descriptionParts.length > 0
      ? descriptionParts.join("\n\n").trim()
      : undefined;

    return {
      guests,
      bedrooms,
      beds,
      baths,
      description,
      lat: derived.lat,
      lng: derived.lng,
      propertyDetailPlatform: "airbnb",
    };
  }

  /**
   * Extract the first matching title from pdpItems that matches the given regex pattern.
   * Returns the full matched text (including the label like "guests", "bedrooms", etc.).
   */
  private extractFromItems(
    items: Array<{ title?: string; action?: unknown }>,
    pattern: RegExp
  ): string | undefined {
    for (const item of items) {
      if (item.title && typeof item.title === "string") {
        const match = item.title.match(pattern);
        if (match && match[0]) {
          return match[0].trim();
        }
      }
    }
    return undefined;
  }
}

