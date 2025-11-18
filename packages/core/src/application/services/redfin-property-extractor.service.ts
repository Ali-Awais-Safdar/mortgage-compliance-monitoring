import { Option } from "@carbonteq/fp";
import type { PropertyDetailsDTO } from "@/application/dto/compare.dto";

export class RedfinPropertyExtractor {
  /**
   * Extract property details from HasData Redfin JSON.
   * Safely navigates the JSON structure to find property fields.
   * Returns PropertyDetailsDTO with only whitelisted keys.
   */
  public extract(json: unknown): PropertyDetailsDTO {
    const property = this.getProperty(json);
    if (!property) {
      // Return minimal object with required address fields
      return {
        address: {
          street: "",
          city: "",
          state: "",
          zipcode: "",
        },
      };
    }

    const address = this.extractAddress(property);
    const bedrooms = this.extractNumber(property, "beds"); // Map beds to bedrooms
    const baths = this.extractNumber(property, "baths");
    const area = this.extractNumber(property, "area");
    const lotSize = this.extractNumber(property, "lotSize");
    const latitude = this.extractNumber(property, "latitude");
    const longitude = this.extractNumber(property, "longitude");
    const yearBuilt = this.extractNumber(property, "yearBuilt");
    const homeType = this.extractString(property, "homeType");
    const description = this.extractString(property, "description");
    const brokerName = this.extractString(property, "brokerName");
    const brokerPhoneNumber = this.extractString(property, "brokerPhoneNumber");
    const agentName = this.extractString(property, "agentName");
    const agentPhoneNumber = this.extractString(property, "agentPhoneNumber");

    return {
      address,
      bedrooms: bedrooms.isSome() ? bedrooms.unwrap() : undefined,
      baths: baths.isSome() ? baths.unwrap() : undefined,
      area: area.isSome() ? area.unwrap() : undefined,
      lotSize: lotSize.isSome() ? lotSize.unwrap() : undefined,
      latitude: latitude.isSome() ? latitude.unwrap() : undefined,
      longitude: longitude.isSome() ? longitude.unwrap() : undefined,
      yearBuilt: yearBuilt.isSome() ? yearBuilt.unwrap() : undefined,
      homeType: homeType.isSome() ? homeType.unwrap() : undefined,
      description: description.isSome() ? description.unwrap() : undefined,
      brokerName: brokerName.isSome() ? brokerName.unwrap() : undefined,
      brokerPhoneNumber: brokerPhoneNumber.isSome() ? brokerPhoneNumber.unwrap() : undefined,
      agentName: agentName.isSome() ? agentName.unwrap() : undefined,
      agentPhoneNumber: agentPhoneNumber.isSome() ? agentPhoneNumber.unwrap() : undefined,
    };
  }

  private getProperty(json: unknown): Record<string, unknown> | null {
    try {
      const data = json as Record<string, unknown>;
      const property = data?.property;
      if (property && typeof property === "object" && property !== null && !Array.isArray(property)) {
        return property as Record<string, unknown>;
      }
    } catch {
      // Ignore errors from safe navigation
    }
    return null;
  }

  private extractAddress(property: Record<string, unknown>): PropertyDetailsDTO["address"] {
    try {
      const address = property.address;
      if (address && typeof address === "object" && address !== null && !Array.isArray(address)) {
        const addr = address as Record<string, unknown>;
        return {
          street: typeof addr.street === "string" ? addr.street : "",
          city: typeof addr.city === "string" ? addr.city : "",
          state: typeof addr.state === "string" ? addr.state : "",
          zipcode: typeof addr.zipcode === "string" ? addr.zipcode : "",
        };
      }
    } catch {
      // Ignore errors from safe navigation
    }
    return {
      street: "",
      city: "",
      state: "",
      zipcode: "",
    };
  }

  private extractNumber(property: Record<string, unknown>, key: string): Option<number> {
    try {
      const value = property[key];
      if (value != null && typeof value === "number" && !Number.isNaN(value)) {
        return Option.Some(value);
      }
    } catch {
      // Ignore errors from safe navigation
    }
    return Option.None;
  }

  private extractString(property: Record<string, unknown>, key: string): Option<string> {
    try {
      const value = property[key];
      if (value != null && typeof value === "string" && value.length > 0) {
        return Option.Some(value);
      }
    } catch {
      // Ignore errors from safe navigation
    }
    return Option.None;
  }
}

