import type { PdpListingDetailsDTO } from "./pdp.dto";

export interface PropertyDetailsDTO {
  address: {
    street: string;
    city: string;
    state: string;
    zipcode: string;
  };
  bedrooms?: number;
  baths?: number;
  area?: number;
  lotSize?: number;
  latitude?: number;
  longitude?: number;
  yearBuilt?: number;
  homeType?: string;
  description?: string;
  brokerName?: string;
  brokerPhoneNumber?: string;
  agentName?: string;
  agentPhoneNumber?: string;
}

export interface CompareListingDetailDTO extends PdpListingDetailsDTO {
  matchPercentage: number;
}

export interface CompareResponseDTO {
  propertyDetails: PropertyDetailsDTO;
  bbox: [number, number, number, number];
  confidenceScore: {
    score: number;
    scale: "0-100";
    basis: string[];
  };
  listingDetails: CompareListingDetailDTO[];
}

