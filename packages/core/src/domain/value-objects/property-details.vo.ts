export interface PropertyDetails {
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

