import { Command, Option } from "commander";
import { callHandler } from "../handlers/call.handler";

export function buildCallCommand() {
  const cmd = new Command("call")
    .description("Call an external API")
    .requiredOption("-u, --url <url>", "absolute request URL")
    .addOption(new Option("-X, --method <m>").default("GET"))
    .option("-H, --header <h...>", "header(s) as Name:Value", (val, prev: string[] | undefined) => (prev ?? []).concat(val))
    .option("-q, --query <q...>", "query pair(s) as key=value", (val, prev: string[] | undefined) => (prev ?? []).concat(val))
    .option("-d, --data <json>", "JSON body")
    .option("--api-key-name <ENV_VAR>", "ENV var that holds an API key (e.g., FOO_API_KEY)")
    .option("--timeout <ms>", "request timeout in ms", (v) => parseInt(v, 10))
    .option("-o, --output <file>", "output file path to save response as JSON")
    .option("--body-override <kv...>", "Patch JSON body path (e.g., variables.staysSearchRequest.rawParams.neLat=41.06)", (val, prev: string[] | undefined) => (prev ?? []).concat(val))
    .option("--listing-id <id>", "Convenience for PDP: sets variables.id and variables.demandStayListingId")
    .action(callHandler);

  return cmd;
}

