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
      const data = json as any;
      const beds = data?.property?.beds;
      
      if (beds != null && typeof beds === "number" && !Number.isNaN(beds)) {
        return Option.Some(beds);
      }
    } catch {
      // Ignore errors from safe navigation
    }
    
    return Option.None;
  }

  private extractBaths(json: unknown): Option<number> {
    try {
      const data = json as any;
      const baths = data?.property?.baths;
      
      if (baths != null && typeof baths === "number" && !Number.isNaN(baths)) {
        return Option.Some(baths);
      }
    } catch {
      // Ignore errors from safe navigation
    }
    
    return Option.None;
  }
}

