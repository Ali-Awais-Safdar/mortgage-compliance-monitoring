import type { PdpListingDetailsDTO } from "./pdp.dto";
import type { PropertyDetails } from "@/domain/value-objects/property-details.vo";

export interface CompareListingDetailDTO extends PdpListingDetailsDTO {
  matchPercentage: number;
}

export interface CompareResponseDTO {
  propertyDetails: PropertyDetails;
  bbox: [number, number, number, number];
  confidenceScore: {
    score: number;
    scale: "0-100";
    basis: string[];
  };
  listingDetails: CompareListingDetailDTO[];
}

