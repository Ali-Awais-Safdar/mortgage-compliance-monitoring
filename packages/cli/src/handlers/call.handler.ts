import {
  BodyPatchService,
  CallExternalWorkflow,
  ResponsePostprocessService,
  UrlPatchService,
} from "@poc/core";
import { matchRes } from "@carbonteq/fp";
import { FetchHttpAdapter, NodeEncodingAdapter } from "@poc/infra";
import { CallOptionsSchema } from "../schemas/call.schema";

function deriveHtmlTextBase(outputPath?: string, overrideBase?: string, listingId?: string): string | null {
  if (overrideBase) return overrideBase;
  if (outputPath) return outputPath.endsWith(".json") ? outputPath.slice(0, -5) : outputPath;
  if (listingId) return `responses/pdp_${listingId}`;
  return null;
}

function formatPdpSbuiBasicListItems(items: Array<{ title?: string; action?: unknown }>): string {
  if (items.length === 0) {
    return "";
  }

  const lines = ["=== PdpSbuiBasicListItem Details ==="];
  for (const item of items) {
    if (!item.title) {
      continue;
    }

    lines.push(`• ${item.title}`);
    if (item.action !== null && item.action !== undefined) {
      lines.push(`  Action: ${JSON.stringify(item.action)}`);
    }
  }

  return lines.join("\n");
}

export const callHandler = async (opts: Record<string, unknown>) => {
  const parsed = CallOptionsSchema.safeParse(opts);

  if (!parsed.success) {
    console.error("Invalid options:");
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "(root)";
      console.error(`- ${path}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const { callInput, apiKeyName, output, htmltextOutput } = parsed.data;

  const headers = callInput.headers ? [...callInput.headers] : [];

  if (apiKeyName) {
    const bunEnv = (globalThis as typeof globalThis & { Bun?: { env?: Record<string, string | undefined> } }).Bun?.env;
    const key = bunEnv?.[apiKeyName] ?? process.env?.[apiKeyName];
    const hasAuthHeader = headers.some((h) => h.name.toLowerCase() === "authorization");
    if (key && !hasAuthHeader) {
      headers.push({ name: "Authorization", value: `Bearer ${key}` });
    }
  }

  const finalInput = {
    ...callInput,
    headers: headers.length > 0 ? headers : undefined,
  };

  const postprocess = new ResponsePostprocessService();
  const workflow = new CallExternalWorkflow(
    new FetchHttpAdapter(),
    new UrlPatchService(new NodeEncodingAdapter()),
    new BodyPatchService(),
    postprocess
  );

  const outcome = await workflow.execute(finalInput);

  matchRes(outcome, {
    Ok: async (result) => {
      const responseJson = JSON.stringify(result.response, null, 2);

      if (output) {
        await Bun.write(output, responseJson);
        console.log(`Response saved to: ${output}`);
      } else {
        console.log(responseJson);
      }

      const listingId = finalInput.flags?.listingId;
      if (listingId && result.derived) {
        const base = deriveHtmlTextBase(output, htmltextOutput, listingId);
        if (base) {
          const cleanedHtml = (result.derived.htmlTexts ?? []).map((html) => postprocess.cleanHtml(html));
          const formattedItems = formatPdpSbuiBasicListItems(result.derived.pdpItems ?? []);

          const outputParts: string[] = [];
          if (formattedItems) {
            outputParts.push(formattedItems);
          }
          if (cleanedHtml.length > 0) {
            outputParts.push(cleanedHtml.join("\n\n---\n\n"));
          }

          if (outputParts.length > 0) {
            await Bun.write(`${base}_html.clean.txt`, outputParts.join("\n\n\n"));
            console.log(`htmlText extracted: ${result.derived.htmlTexts?.length ?? 0}`);
            console.log(`PdpSbuiBasicListItem items: ${result.derived.pdpItems?.length ?? 0}`);
            console.log(`Clean: ${base}_html.clean.txt`);
          } else {
            console.log("No htmlText or PDP items to write.");
          }
        } else {
          console.warn("Could not resolve htmlText output base. Provide -o/--output or --htmltext-output.");
        }
      }
    },
    Err: async (err) => {
      if (err.kind === "TimeoutError") {
        console.error(`Timeout after ${err.timeoutMs ?? "?"} ms`);
        process.exitCode = 124;
        return;
      }
      console.error(`Request failed: ${err.message}`);
      process.exitCode = 1;
    },
  });
};

