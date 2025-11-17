import { Option } from "@carbonteq/fp";

export interface ExtractedRedfinData {
  beds?: number;
  baths?: number;
}

export class RedfinPropertyExtractor {
  /**
   * Extract beds and baths from HasData Redfin JSON.
   * Safely navigates the JSON structure to find property.beds and property.baths.
   */
  public extract(json: unknown): ExtractedRedfinData {
    const bedsOpt = this.extractBeds(json);
    const bathsOpt = this.extractBaths(json);

    return {
      beds: bedsOpt.isSome() ? bedsOpt.unwrap() : undefined,
      baths: bathsOpt.isSome() ? bathsOpt.unwrap() : undefined,
    };
  }

  private extractBeds(json: unknown): Option<number> {
    try {
      const data = json as Record<string, unknown>;
      const property = data?.property;
      if (property && typeof property === "object" && property !== null) {
        const propertyObj = property as Record<string, unknown>;
        const beds = propertyObj?.beds;
        
        if (beds != null && typeof beds === "number" && !Number.isNaN(beds)) {
          return Option.Some(beds);
        }
      }
    } catch {
      // Ignore errors from safe navigation
    }
    
    return Option.None;
  }

  private extractBaths(json: unknown): Option<number> {
    try {
      const data = json as Record<string, unknown>;
      const property = data?.property;
      if (property && typeof property === "object" && property !== null) {
        const propertyObj = property as Record<string, unknown>;
        const baths = propertyObj?.baths;
        
        if (baths != null && typeof baths === "number" && !Number.isNaN(baths)) {
          return Option.Some(baths);
        }
      }
    } catch {
      // Ignore errors from safe navigation
    }
    
    return Option.None;
  }
}

