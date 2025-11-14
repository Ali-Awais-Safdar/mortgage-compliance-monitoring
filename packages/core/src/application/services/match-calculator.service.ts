export interface MatchResult {
  bedroomsMatch?: boolean;
  bathsMatch?: boolean;
  totalComparisons: number;
  matches: number;
  percentage: number; // 0..100
}

export class MatchCalculator {
  /**
   * Calculate match between Airbnb and Redfin property data.
   * 
   * Rules:
   * - Bedrooms: strict equality (airbnbBedrooms === redfinBeds)
   * - Baths: tolerance ±0.5 (Math.abs(airbnbBaths - redfinBaths) <= 0.5)
   * 
   * Percentage calculation:
   * - If both comparisons available: each worth 50%
   * - If only one pair present: that pair counts for 100%
   * - If none present: totalComparisons = 0 (workflow should Err)
   */
  calcMatch(
    airbnbBedrooms?: number,
    redfinBeds?: number,
    airbnbBaths?: number,
    redfinBaths?: number
  ): MatchResult {
    const comparisons: Array<{ matched: boolean }> = [];
    let bedroomsMatch: boolean | undefined;
    let bathsMatch: boolean | undefined;

    // Compare bedrooms if both values are present
    if (airbnbBedrooms != null && redfinBeds != null) {
      bedroomsMatch = airbnbBedrooms === redfinBeds;
      comparisons.push({ matched: bedroomsMatch });
    }

    // Compare baths if both values are present
    if (airbnbBaths != null && redfinBaths != null) {
      bathsMatch = Math.abs(airbnbBaths - redfinBaths) <= 0.5;
      comparisons.push({ matched: bathsMatch });
    }

    const totalComparisons = comparisons.length;
    const matches = comparisons.filter((c) => c.matched).length;

    // Calculate percentage
    let percentage = 0;
    if (totalComparisons > 0) {
      percentage = totalComparisons === 2 
        ? (matches / 2) * 100
        : matches * 100;
    }

    return {
      bedroomsMatch,
      bathsMatch,
      totalComparisons,
      matches,
      percentage: Math.round(percentage),
    };
  }
}

