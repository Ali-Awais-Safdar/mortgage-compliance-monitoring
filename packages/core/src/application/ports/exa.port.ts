import type { Result, Option } from "@carbonteq/fp";
import type { AppError } from "../errors/app-error";

export type ExaSearchType = "keyword" | "auto";

export interface ExaSearchResult {
  results: Array<{ url?: string; id?: string }>;
}

export interface PageAddress {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
}

export interface ExaPort {
  /**
   * Searches Exa API for results matching the query.
   */
  search(params: {
    query: string;
    type: ExaSearchType;
    numResults?: number;
    includeDomains?: string[];
  }): Promise<Result<ExaSearchResult, AppError>>;

  /**
   * Fetches page content and extracts address information from a URL.
   * Returns Option.Some if address is found, Option.None otherwise.
   */
  fetchPageAddress(url: string): Promise<Result<Option<PageAddress>, AppError>>;
}

