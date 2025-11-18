import { Result } from "@carbonteq/fp";
import type { AppError } from "../errors/app-error";
import type { WebSearchPort, SearchResultItem } from "../ports/search.port";

// ========= Constants =========

const STATE_MAP: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
  dc: "DC",
};

const STREET_TYPES = new Set<string>([
  "st",
  "street",
  "rd",
  "road",
  "ave",
  "avenue",
  "blvd",
  "boulevard",
  "dr",
  "drive",
  "ln",
  "lane",
  "ct",
  "court",
  "pl",
  "place",
  "ter",
  "terrace",
  "pkwy",
  "parkway",
  "cir",
  "circle",
  "hwy",
  "highway",
  "way",
]);

const DIR_LONG2SHORT: Record<string, string> = {
  north: "N",
  south: "S",
  east: "E",
  west: "W",
};

const UNIT_RE = /(?:#\s*([A-Za-z0-9-]+)|\b(?:unit|apt|apartment|ste|suite)\s*([A-Za-z0-9-]+))/i;
const ZIP_RE = /\b(\d{5})(?:-\d{4})?\b/;
const REDFIN_PROP_RE = /^https?:\/\/(?:www\.)?redfin\.com\/[A-Z]{2}\/[^/]+\/.+?\/home\/\d+(?:[/?#]|$)/i;

// ========= Types =========

interface ParsedAddress {
  line: string;
  city: string;
  state: string;
  zip: string;
  unit: string;
  num: string;
  core: string;
}


// ========= Helper Functions =========

function _stripCountry(s: string): string {
  return s.replace(/(,\s*)?(?:USA|United\s+States(?:\s+of\s+America)?)\s*$/i, "").trim();
}

function parseStreetLine(line: string): [string, string, string] {
  // try to capture [num] [predir?] [name...] [type?] [unit?]
  const m = line.match(
    /^\s*(?<num>\d+)\s+(?:(?<predir>N|S|E|W|North|South|East|West)\.?\s+)?(?<name>[A-Za-z0-9'\- ]+?)\s*(?:(?<type>st|street|rd|road|ave|avenue|blvd|boulevard|dr|drive|ln|lane|ct|court|pl|place|ter|terrace|pkwy|parkway|cir|circle|hwy|highway|way)\.?)?/i
  );

  let num = "";
  let core = "";

  if (m) {
    num = m.groups?.num ?? "";
    let predir = (m.groups?.predir ?? "").toLowerCase();
    if (predir && predir in DIR_LONG2SHORT) {
      predir = DIR_LONG2SHORT[predir] ?? predir;
    }
    predir = predir.toUpperCase().replace(/\./g, "");
    const name = (m.groups?.name ?? "").trim().toLowerCase();
    core = predir ? `${predir} ${name}`.trim() : name;

    // drop stop-words like the type at the end of 'name' if user included it
    const tokens = core.split(" ");
    if (tokens.length > 0 && STREET_TYPES.has(tokens[tokens.length - 1]?.toLowerCase().replace(/\.$/, "") ?? "")) {
      tokens.pop();
    }
    core = tokens.join(" ");
  }

  let unit = "";
  const m2 = UNIT_RE.exec(line);
  if (m2) {
    unit = ((m2[1] ?? m2[2]) ?? "").toLowerCase();
    unit = unit.replace(/^0+/, "") || unit; // normalize 02 -> 2
  }

  return [num, core, unit];
}

function parseInputAddress(addr: string): ParsedAddress {
  // Lightweight parse → dict(line, city, state, zip, unit, num, core)
  const s = _stripCountry(addr.replace(/\s+/g, " ").replace(/^,\s*|\s*,$/g, "").trim());
  const parts = s.split(",").map((p) => p.trim());
  const line = parts[0] ?? s;
  const city = parts[1] ?? "";
  const stZip = parts[2] ?? "";

  const zipMatch = ZIP_RE.exec(s);
  const z = zipMatch?.[1] ?? "";

  const stateTok = stZip.trim().split(" ")[0] ?? "";
  const stKey = stateTok.toLowerCase();
  const state = STATE_MAP[stKey] ?? stateTok.toUpperCase();

  // street number + core (predir + name without type), and unit
  const [num, core, unit] = parseStreetLine(line);

  return { line, city, state, zip: z, unit, num, core };
}

function buildQueryVariants(addr: string): string[] {
  const p = parseInputAddress(addr);
  const cityQ = p.city ? ` "${p.city}"` : "";
  const stZip = `${p.state} ${p.zip}`.trim();

  const variants = new Set<string>();

  // keep original first line; craft #unit + Unit unit variants if present
  const baseLine = p.line.split(",")[0]?.trim() ?? "";
  const noUnit = baseLine.replace(/(?:,?\s*(?:#|unit|apt|apartment|ste|suite)\s*[A-Za-z0-9-]+)/i, "").trim();

  if (p.unit) {
    variants.add(`"${noUnit} #${p.unit}"${cityQ} ${stZip}`);
    variants.add(`"${noUnit} Unit ${p.unit}"${cityQ} ${stZip}`);
  }

  variants.add(`"${noUnit}"${cityQ} ${stZip}`);

  // minimal quoted number + core + city/state/zip
  const coreMin = `${p.num} ${p.core}`.trim();
  if (p.num && p.core) {
    variants.add(`"${coreMin}"${cityQ} ${stZip}`);
  }

  return Array.from(variants).map((q) => q.trim()).filter((q) => q.length > 0);
}

function looksLikeRedfinProperty(url: string): boolean {
  return REDFIN_PROP_RE.test(url ?? "");
}

function normalizeState(s: string): string {
  if (!s) return "";
  const trimmed = s.trim();
  return STATE_MAP[trimmed.toLowerCase()] ?? trimmed.toUpperCase();
}

function extractUnitFromStreet(street: string): string {
  if (!street) return "";
  const m = UNIT_RE.exec(street);
  if (!m) return "";
  const u = ((m[1] ?? m[2]) ?? "").toLowerCase();
  return u.replace(/^0+/, "") || u;
}

// ========= Service Class =========

export class RedfinUrlFinderService {
  constructor(private readonly search: WebSearchPort) {}

  private async validateCandidate(url: string, inputAddr: string): Promise<boolean> {
    const pageResult = await this.search.fetchPageAddress(url);
    
    if (pageResult.isErr()) {
      return false;
    }

    const pageOpt = pageResult.unwrap();
    if (pageOpt.isNone()) {
      return false;
    }

    const page = pageOpt.unwrap();
    const inp = parseInputAddress(inputAddr);

    // parse the street from page to line up comparison
    const pgStreet = (page.streetAddress ?? "").trim();
    const pgCity = (page.addressLocality ?? "").trim();
    const pgState = normalizeState(page.addressRegion ?? "");
    const pgZip = (page.postalCode ?? "").trim();
    const [pgNum, pgCore, pgUnitInitial] = parseStreetLine(pgStreet);
    let pgUnit = pgUnitInitial;
    if (!pgUnit) {
      pgUnit = extractUnitFromStreet(pgStreet);
    }

    // Must match: number + street core
    if (!inp.num || !inp.core || !pgNum || !pgCore) {
      return false;
    }
    if (inp.num !== pgNum) return false;
    if (inp.core !== pgCore) return false;

    // City/state if both present
    if (inp.city && pgCity && inp.city.trim().toLowerCase() !== pgCity.toLowerCase()) {
      return false;
    }
    if (inp.state && pgState && normalizeState(inp.state) !== pgState) {
      return false;
    }

    // ZIP if both present
    if (inp.zip && pgZip && inp.zip !== pgZip) {
      return false;
    }

    // If input had a unit, require match (when page has a detectable unit)
    if (inp.unit) {
      if (pgUnit && inp.unit !== pgUnit) {
        return false;
      }
      if (!pgUnit) {
        // allow if Redfin omits unit in streetAddress (happens sometimes)
        // but keep it strict: reject if you want pure determinism with units
        return false;
      }
    }

    return true;
  }

  private async chooseRedfinUrl(results: SearchResultItem[], address: string): Promise<string | null> {
    for (const r of results) {
      const url = r.url;
      if (!looksLikeRedfinProperty(url)) {
        continue;
      }
      const isValid = await this.validateCandidate(url, address);
      if (isValid) {
        return url;
      }
    }
    return null;
  }

  async findRedfinUrlForAddress(
    address: string,
    perQueryResults: number = 10,
    timeoutMs?: number,
  ): Promise<Result<string, AppError>> {
    // Validate input
    const validationResult = await Result.Ok(address)
      .validate([
        (addr: string) => {
          if (!addr || addr.trim().length === 0) {
            return Result.Err({
              kind: "InvalidInputError",
              message: "Address cannot be empty",
            } as AppError);
          }
          return Result.Ok(addr);
        },
      ])
      .mapErr((errs: AppError | AppError[]) => {
        const fallback = "Invalid address";
        if (Array.isArray(errs)) {
          return errs
            .map((e) => e.message ?? fallback)
            .join("; ");
        }
        return errs.message ?? fallback;
      })
      .mapErr((message) => ({ kind: "InvalidInputError", message } as AppError))
      .toPromise();

    if (validationResult.isErr()) {
      return validationResult;
    }

    const variants = buildQueryVariants(address);
    let hadSuccessfulSearch = false;
    let lastErr: AppError | null = null;

    // Pass 1: exact (precise)
    for (const q of variants) {
      const searchResult = await this.search.search({
        query: q,
        mode: "exact",
        numResults: perQueryResults,
        includeDomains: ["redfin.com"],
        timeoutMs,
      });

      if (searchResult.isErr()) {
        lastErr = searchResult.unwrapErr();
        continue;
      }

      hadSuccessfulSearch = true;
      const chosen = await this.chooseRedfinUrl(searchResult.unwrap().results, address);
      if (chosen) {
        return Result.Ok(chosen);
      }
    }

    // Pass 2: broad (recall)
    for (const q of variants) {
      const searchResult = await this.search.search({
        query: q,
        mode: "broad",
        numResults: perQueryResults,
        includeDomains: ["redfin.com"],
        timeoutMs,
      });

      if (searchResult.isErr()) {
        lastErr = searchResult.unwrapErr();
        continue;
      }

      hadSuccessfulSearch = true;
      const chosen = await this.chooseRedfinUrl(searchResult.unwrap().results, address);
      if (chosen) {
        return Result.Ok(chosen);
      }
    }

    if (!hadSuccessfulSearch && lastErr) {
      // propagate the external failure (TimeoutError / TransportError / InvalidResponseError)
      return Result.Err(lastErr);
    }

    // We did get search results, but no candidate URL validated
    console.warn("[RedfinUrlFinder] no valid URL found", { address });
    return Result.Err({
      kind: "InvalidResponseError",
      message: "No Redfin URL found for the given address",
    } as AppError);
  }
}

