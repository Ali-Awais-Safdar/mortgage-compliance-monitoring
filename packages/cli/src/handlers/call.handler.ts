import { CallExternalWorkflow, type ApiRequestDTO } from "@poc/core";
import { FetchHttpAdapter } from "@poc/infra";

function parseOverrideKv(str: string): { key: string; value: any } {
  const eqIndex = str.indexOf("=");
  if (eqIndex === -1) {
    throw new Error("Expected key=value");
  }
  const key = str.substring(0, eqIndex);
  const valueStr = str.substring(eqIndex + 1);
  
  let value: any = valueStr;
  
  // Try JSON parse if starts with { or [
  if (valueStr.trim().startsWith("{") || valueStr.trim().startsWith("[")) {
    try {
      value = JSON.parse(valueStr);
    } catch {
      // Keep as string if parse fails
    }
  }
  // Handle primitives: true, false, null
  else if (valueStr === "true") {
    value = true;
  } else if (valueStr === "false") {
    value = false;
  } else if (valueStr === "null") {
    value = null;
  }
  // Check if numeric-looking
  else if (/^-?\d+(\.\d+)?$/.test(valueStr)) {
    const num = parseFloat(valueStr);
    if (!isNaN(num)) {
      value = num;
    }
  }
  
  return { key, value };
}

function setAtPath(target: any, path: string, value: any): void {
  const parts = path.split(".");
  if (parts.length === 0) return;
  
  let current = target;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!part) continue;
    
    // Support numeric keys for arrays
    const numKey = /^\d+$/.test(part) ? parseInt(part, 10) : part;
    
    if (current[numKey] === undefined || current[numKey] === null) {
      // Check if next part is numeric to decide if we need an array
      const nextPart = parts[i + 1];
      current[numKey] = nextPart && /^\d+$/.test(nextPart) ? [] : {};
    }
    current = current[numKey];
  }
  
  const lastPart = parts[parts.length - 1];
  if (!lastPart) return;
  const numKey = /^\d+$/.test(lastPart) ? parseInt(lastPart, 10) : lastPart;
  current[numKey] = value;
}

function coercePreservingType(existingValue: any, provided: any): any {
  if (existingValue !== undefined && existingValue !== null) {
    if (typeof existingValue === "string") {
      return String(provided);
    }
    if (typeof existingValue === "number") {
      const num = typeof provided === "number" ? provided : parseFloat(String(provided));
      if (!isNaN(num)) {
        return num;
      }
    }
  }
  return provided;
}

function patchUrlJsonParam(url: URL, paramName: string, jsonPath: string, newValue: any): void {
  const raw = url.searchParams.get(paramName);
  let obj: any = {};
  
  if (raw) {
    try {
      obj = JSON.parse(raw);
    } catch {
      try {
        obj = JSON.parse(decodeURIComponent(raw));
      } catch {
        // If parsing fails, start with empty object
        obj = {};
      }
    }
  }
  
  // Traverse to existing leaf if it exists
  const parts = jsonPath.split(".");
  let current = obj;
  let existingLeaf: any = undefined;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!part) continue;
    if (current[part] === undefined) {
      current[part] = {};
    }
    current = current[part];
  }
  
  const lastPart = parts[parts.length - 1];
  if (lastPart && current[lastPart] !== undefined) {
    existingLeaf = current[lastPart];
  }
  
  // Coerce preserving type if leaf exists
  const finalValue = existingLeaf !== undefined 
    ? coercePreservingType(existingLeaf, newValue)
    : newValue;
  
  setAtPath(obj, jsonPath, finalValue);
  url.searchParams.set(paramName, JSON.stringify(obj));
}

function patchRawParams(body: any, filterName: string, filterValue: any): void {
  // Ensure both paths exist
  if (!body.variables) {
    body.variables = {};
  }
  if (!body.variables.staysSearchRequest) {
    body.variables.staysSearchRequest = {};
  }
  if (!body.variables.staysSearchRequest.rawParams) {
    body.variables.staysSearchRequest.rawParams = [];
  }
  if (!body.variables.staysMapSearchRequestV2) {
    body.variables.staysMapSearchRequestV2 = {};
  }
  if (!body.variables.staysMapSearchRequestV2.rawParams) {
    body.variables.staysMapSearchRequestV2.rawParams = [];
  }
  
  const arr1 = body.variables.staysSearchRequest.rawParams;
  const arr2 = body.variables.staysMapSearchRequestV2.rawParams;
  
  // Helper to update or add filter
  const updateFilter = (arr: any[]) => {
    const existing = arr.find((item: any) => item.filterName === filterName);
    if (existing) {
      existing.filterValues = [String(filterValue)];
    } else {
      arr.push({ filterName, filterValues: [String(filterValue)] });
    }
  };
  
  updateFilter(arr1);
  updateFilter(arr2);
}

function applyBodyOverride(body: any, path: string, value: any): void {
  // Check if path targets rawParams
  if (path.startsWith("variables.staysSearchRequest.rawParams.") || 
      path.startsWith("variables.staysMapSearchRequestV2.rawParams.")) {
    // Extract filterName (the part after rawParams.)
    const rawParamsIndex = path.indexOf("rawParams.");
    if (rawParamsIndex !== -1) {
      const filterName = path.substring(rawParamsIndex + "rawParams.".length);
      patchRawParams(body, filterName, value);
      return;
    }
  }
  
  // Normal path update with type preservation
  const parts = path.split(".");
  let current = body;
  let existingLeaf: any = undefined;
  
  // Traverse to check if leaf exists
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!part) continue;
    if (current[part] === undefined) {
      current[part] = {};
    }
    current = current[part];
  }
  
  const lastPart = parts[parts.length - 1];
  if (lastPart && current[lastPart] !== undefined) {
    existingLeaf = current[lastPart];
  }
  
  const finalValue = existingLeaf !== undefined
    ? coercePreservingType(existingLeaf, value)
    : value;
  
  setAtPath(body, path, finalValue);
}

export interface CallOptions {
  url: string;
  method?: string;
  header?: string[];
  query?: string[];
  data?: string;
  apiKeyName?: string;
  timeout?: number;
  output?: string;
  bodyOverride?: string[];
  listingId?: string;
}

export const callHandler = async (opts: CallOptions) => {
  const headers = (opts.header ?? []).map((h) => {
    const [name, ...rest] = h.split(":");
    return { name: (name ?? "").trim(), value: rest.join(":").trim() };
  });

  const query = Object.fromEntries(
    (opts.query ?? []).map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v];
    })
  );

  const method = (opts.method?.toUpperCase() ?? "GET") as ApiRequestDTO["method"];

  // Handle URL modifications (listing ID convenience)
  const url = new URL(opts.url);

  // Handle listing ID convenience
  if (opts.listingId) {
    const stayId = Buffer.from(`StayListing:${opts.listingId}`).toString("base64");
    const demandStayId = Buffer.from(`DemandStayListing:${opts.listingId}`).toString("base64");
    patchUrlJsonParam(url, "variables", "id", stayId);
    patchUrlJsonParam(url, "variables", "demandStayListingId", demandStayId);
  }

  // Apply body overrides
  let bodyObj: any = undefined;
  if (opts.data) {
    try {
      bodyObj = JSON.parse(opts.data);
    } catch {
      const snippet = opts.data.length > 50 ? opts.data.substring(0, 50) + "..." : opts.data;
      throw new Error(`Failed to parse --data JSON. Snippet: ${snippet}`);
    }

    // Apply body overrides
    for (const override of opts.bodyOverride ?? []) {
      try {
        const { key: path, value } = parseOverrideKv(override);
        applyBodyOverride(bodyObj, path, value);
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Invalid --body-override "${override}": ${error.message}`);
        }
        throw error;
      }
    }
  }

  const dto: ApiRequestDTO = {
    url: url.toString(),
    method,
    headers,
    query,
    body: bodyObj,
    apiKeyName: opts.apiKeyName,
    timeoutMs: opts.timeout
  };

  const wf = new CallExternalWorkflow(new FetchHttpAdapter());
  const res = await wf.execute(dto);
  
  const responseJson = JSON.stringify(res, null, 2);
  
  if (opts.output) {
    // Write response to file
    await Bun.write(opts.output, responseJson);
    console.log(`Response saved to: ${opts.output}`);
  } else {
    // Print to console if no output file specified
    console.log(responseJson);
  }
};

