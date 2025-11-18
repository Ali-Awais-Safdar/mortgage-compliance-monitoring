export interface PdpDerivedData {
  htmlTexts?: string[];
  pdpItems?: Array<{ title?: string; action?: unknown }>;
  listingId?: string;
  lat?: number;
  lng?: number;
}

export interface PdpListingDetailsDTO {
  guests?: string;
  bedrooms?: string;
  beds?: string;
  baths?: string;
  description?: string;
  lat?: number;
  lng?: number;
  propertyDetailPlatform: "airbnb";
}

