import { z, type RefinementCtx } from "zod";
import type { CallWorkflowInput } from "@poc/core";

const MethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const HeaderEntrySchema = z.string().transform((raw: string, ctx: RefinementCtx) => {
  const separatorIndex = raw.indexOf(":");
  if (separatorIndex <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid header "${raw}". Expected "Name:Value"`,
    });
    return z.NEVER;
  }

  const name = raw.slice(0, separatorIndex).trim();
  const value = raw.slice(separatorIndex + 1).trim();

  if (!name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Header name is required in "${raw}"`,
    });
    return z.NEVER;
  }

  return { name, value };
});

const HeadersSchema = z
  .array(HeaderEntrySchema)
  .optional()
  .transform((headers: Array<{ name: string; value: string }> | undefined) =>
    headers && headers.length > 0 ? headers : undefined
  );

const QueryEntrySchema = z.string().transform((raw: string, ctx: RefinementCtx) => {
  const separatorIndex = raw.indexOf("=");
  if (separatorIndex <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid query "${raw}". Expected "key=value"`,
    });
    return z.NEVER;
  }

  const key = raw.slice(0, separatorIndex).trim();
  const value = raw.slice(separatorIndex + 1);

  if (!key) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Query key is required in "${raw}"`,
    });
    return z.NEVER;
  }

  return { key, value };
});

const QuerySchema = z
  .array(QueryEntrySchema)
  .optional()
  .transform((entries: Array<{ key: string; value: string }> | undefined) => {
    if (!entries || entries.length === 0) {
      return undefined;
    }

    return entries.reduce<Record<string, string>>((acc, pair) => {
      acc[pair.key] = pair.value;
      return acc;
    }, {} as Record<string, string>);
  });

const JsonBodySchema = z
  .string()
  .transform((str: string, ctx: RefinementCtx) => {
    try {
      return JSON.parse(str);
    } catch {
      const snippet = str.length > 50 ? `${str.slice(0, 50)}...` : str;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Failed to parse --data JSON. Snippet: ${snippet}`,
      });
      return z.NEVER;
    }
  })
  .optional();

const OptionalNumberSchema = z
  .union([z.number(), z.string()])
  .optional()
  .transform((value: number | string | undefined, ctx: RefinementCtx) => {
    if (value === undefined) {
      return undefined;
    }

    const num = typeof value === "number" ? value : Number.parseFloat(value);
    if (Number.isFinite(num)) {
      return num;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Expected a finite number, received "${value}"`,
    });
    return z.NEVER;
  });

const OptionalBooleanSchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value: boolean | string | undefined, ctx: RefinementCtx) => {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === "boolean") {
      return value;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Expected a boolean value, received "${value}"`,
    });
    return z.NEVER;
  });

const BodyOverrideSchema = z
  .array(z.string())
  .optional()
  .transform((entries: string[] | undefined, ctx: RefinementCtx) => {
    if (!entries || entries.length === 0) {
      return undefined;
    }

    const overrides: Array<{ path: string; value: unknown }> = [];
    let hasErrors = false;

    for (const entry of entries) {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid --body-override "${entry}". Expected path=value`,
        });
        hasErrors = true;
        continue;
      }

      const path = entry.slice(0, separatorIndex).trim();
      const rawValue = entry.slice(separatorIndex + 1);
      if (!path) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Override path is required in "${entry}"`,
        });
        hasErrors = true;
        continue;
      }

      const parsedValue = parseOverrideValue(rawValue);
      overrides.push({ path, value: parsedValue });
    }

    if (hasErrors) {
      return z.NEVER;
    }

    return overrides.length > 0 ? overrides : undefined;
  });

const RawCallOptionsSchema = z.object({
  url: z.string().url(),
  method: MethodSchema.optional().default("GET"),
  header: HeadersSchema,
  query: QuerySchema,
  data: JsonBodySchema,
  apiKeyName: z.string().optional(),
  timeout: OptionalNumberSchema,
  output: z.string().optional(),
  htmltextOutput: z.string().optional(),
  bodyOverride: BodyOverrideSchema,
  listingId: z.string().optional(),
  bbox: z.string().optional(),
  poiPlace: z.string().optional(),
  poiAcp: z.string().optional(),
  queryAddress: z.string().optional(),
  zoomLevel: OptionalNumberSchema,
  refinementPath: z.string().optional(),
  searchByMap: OptionalBooleanSchema,
});

type RawCallOptions = z.infer<typeof RawCallOptionsSchema>;

export const CallOptionsSchema = RawCallOptionsSchema.transform((raw: RawCallOptions) => {
  const flagsBase: CallWorkflowInput["flags"] = {
    listingId: raw.listingId,
    bbox: raw.bbox,
    poiPlace: raw.poiPlace,
    poiAcp: raw.poiAcp,
    queryAddress: raw.queryAddress,
    zoomLevel: raw.zoomLevel,
    refinementPath: raw.refinementPath,
    searchByMap: raw.searchByMap ?? true,
  };

  const normalizedFlagsEntries = Object.entries(flagsBase ?? {}).filter(([, value]) => value !== undefined);
  const normalizedFlags = normalizedFlagsEntries.length > 0
    ? (Object.fromEntries(normalizedFlagsEntries) as CallWorkflowInput["flags"])
    : undefined;

  const callInput: CallWorkflowInput = {
    url: raw.url,
    method: raw.method,
    headers: raw.header,
    query: raw.query,
    body: raw.data,
    flags: normalizedFlags,
    overrides: raw.bodyOverride,
    timeoutMs: raw.timeout,
  };

  return {
    callInput,
    output: raw.output,
    htmltextOutput: raw.htmltextOutput,
    apiKeyName: raw.apiKeyName,
  };
});

function parseOverrideValue(rawValue: string): unknown {
  const trimmed = rawValue.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through to treat as string when JSON parse fails
    }
  }

  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed === "null") {
    return null;
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number.parseFloat(trimmed);
    if (!Number.isNaN(num)) {
      return num;
    }
  }

  return trimmed;
}

