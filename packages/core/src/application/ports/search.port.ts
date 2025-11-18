import type { Result, Option } from "@carbonteq/fp";
import type { AppError } from "../errors/app-error";

export type SearchMode = "exact" | "broad";

export interface SearchResultItem {
  url: string;
}

export interface PageAddress {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
}

export interface WebSearchPort {
  search(input: {
    query: string;
    mode: SearchMode;
    numResults?: number;
    includeDomains?: string[];
    timeoutMs?: number;
  }): Promise<Result<{ results: SearchResultItem[] }, AppError>>;

  fetchPageAddress(url: string): Promise<Result<Option<PageAddress>, AppError>>;
}

