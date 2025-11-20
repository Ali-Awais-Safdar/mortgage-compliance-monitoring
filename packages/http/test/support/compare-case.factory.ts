import type { CompareListingsByAddressInput } from "@poc/core";

export interface RawCompareScenarioJson {
  id: string;
  note?: string;
  input: {
    address: string;
    timeoutMs?: number;
  };
  expect: {
    propertyDetails?: {
      bedrooms?: number;
      baths?: number;
    };
    redfinUrl?: string;
  };
}

export interface CompareScenario {
  id: string;
  note?: string;
  input: CompareListingsByAddressInput;
  expect: {
    propertyDetails?: {
      bedrooms?: number;
      baths?: number;
    };
    redfinUrl?: string;
  };
}

const DEFAULT_TIMEOUT_MS = 15000;

export function buildScenario(raw: RawCompareScenarioJson): CompareScenario {
  return {
    id: raw.id,
    note: raw.note,
    input: {
      address: raw.input.address,
      timeoutMs: raw.input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
    expect: {
      propertyDetails: raw.expect.propertyDetails,
      redfinUrl: raw.expect.redfinUrl,
    },
  };
}

