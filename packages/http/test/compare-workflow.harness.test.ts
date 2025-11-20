import { test, expect } from "bun:test";
import { matchRes } from "@carbonteq/fp";
import type {
  CompareResponseDTO,
  CompareDebugEvent,
  CompareListingsByAddressConfig,
  PdpBatchFetchConfig,
} from "@poc/core";
import {
  CompareListingsByAddressWorkflow,
  DeterministicViewportSearchService,
  PdpBatchFetchService,
  PdpJsonSerializer,
  AirbnbPdpExtractor,
  RedfinUrlFinderService,
  RedfinPropertyExtractor,
  MatchCalculator,
} from "@poc/core";
import {
  createCoreWorkflow,
  WebSearchExaAdapter,
  AirbnbProviderAdapter,
  HasDataAdapter,
  LocationIqGeocodingAdapter,
  FetchHttpAdapter,
  NovadaProxyHttpAdapter,
  type NovadaProxyConfig,
} from "@poc/infra";
import { loadConfig, type HttpServerConfig } from "../src/config/env.config";
import { readJsonLines } from "./support/jsonl";
import {
  buildScenario,
  type RawCompareScenarioJson,
  type CompareScenario,
} from "./support/compare-case.factory";

const FIXTURES_PATH = new URL("./fixtures/compare-scenarios.jsonl", import.meta.url).pathname;

const config = loadConfig();
const { compareWorkflow, compareConfig } = buildTestCompareWorkflow(config);

const raw = await readJsonLines<RawCompareScenarioJson>(FIXTURES_PATH);
const allScenarios: CompareScenario[] = raw.map(buildScenario);
const scenarioIdFilter = process.env.SCENARIO_ID;
const scenarios = scenarioIdFilter ? allScenarios.filter((s) => s.id === scenarioIdFilter) : allScenarios;

test(
  "CompareListingsByAddressWorkflow harness (real adapters)",
  { timeout: 1800000 },
  async () => {
  for (const scenario of scenarios) {
    const events: CompareDebugEvent[] = [];

    compareConfig.debugLog = (event: CompareDebugEvent) => {
      events.push(event);
      console.log(`[CompareHarness][${scenario.id}][${event.type}]`, event.payload);
    };

    const res = await compareWorkflow.execute(scenario.input);

    matchRes(res, {
      Ok: (dto) => {
        assertCompareOk(dto, scenario, events);
      },
      Err: (err) => {
        throw new Error(`[${scenario.id}] Compare failed: ${err.kind} - ${err.message}`);
      },
    });

    compareConfig.debugLog = undefined;
  }
  }
);

function assertCompareOk(dto: CompareResponseDTO, scenario: CompareScenario, events: CompareDebugEvent[]) {
  const { propertyDetails } = dto;

  if (scenario.expect.propertyDetails?.bedrooms !== undefined) {
    expect(propertyDetails.bedrooms).toBe(scenario.expect.propertyDetails.bedrooms);
  }

  if (scenario.expect.propertyDetails?.baths !== undefined) {
    expect(propertyDetails.baths).toBe(scenario.expect.propertyDetails.baths);
  }

  if (scenario.expect.redfinUrl) {
    const redfinEvent = events.find((event) => event.type === "redfin-url");
    expect(redfinEvent?.payload.redfinUrl).toBe(scenario.expect.redfinUrl);
  }
}

function buildTestCompareWorkflow(config: HttpServerConfig) {
  const outboundHttp = config.novadaProxyEnabled
    ? new NovadaProxyHttpAdapter(buildNovadaProxyConfigForTests(config))
    : new FetchHttpAdapter();

  const { callWorkflow, postprocess } = createCoreWorkflow({ http: outboundHttp });

  const geocoder = new LocationIqGeocodingAdapter(new FetchHttpAdapter(), {
    baseUrl: config.locationIqBase,
    apiKey: config.locationIqKey,
    defaultTimeoutMs: config.defaultTimeoutMs,
  });

  const airbnbProvider = new AirbnbProviderAdapter(callWorkflow, {
    airbnbSearchUrl: config.airbnbSearchUrl,
    airbnbUrl: config.airbnbUrl,
    airbnbSearchBody: config.airbnbSearchBody,
    apiKey: config.apiKey,
    defaultTimeoutMs: config.defaultTimeoutMs,
  });

  const viewportSearch = new DeterministicViewportSearchService(geocoder, airbnbProvider);

  const pdpBatchConfig: PdpBatchFetchConfig = {
    airbnbUrl: config.airbnbUrl,
    apiKey: config.apiKey,
    defaultTimeoutMs: config.defaultTimeoutMs,
    maxConcurrency: config.pdpMaxConcurrency,
    maxRetries: config.pdpMaxRetries,
    baseDelayMs: config.pdpBaseDelayMs,
    jitterFactor: config.pdpJitterFactor,
  };

  const pdpBatchService = new PdpBatchFetchService(callWorkflow, pdpBatchConfig);

  const serializer = new PdpJsonSerializer();

  const webSearch = new WebSearchExaAdapter(
    {
      baseUrl: config.exaBase,
      apiKey: config.exaApiKey,
      defaultTimeoutMs: config.defaultTimeoutMs,
    },
    new FetchHttpAdapter()
  );

  const propertyContent = new HasDataAdapter(new FetchHttpAdapter(), {
    baseUrl: config.hasDataBase,
    apiKey: config.hasDataApiKey,
    defaultTimeoutMs: config.defaultTimeoutMs,
  });

  const redfinFinder = new RedfinUrlFinderService(webSearch);
  const pdpExtractor = new AirbnbPdpExtractor(postprocess);
  const redfinExtractor = new RedfinPropertyExtractor();
  const matchCalculator = new MatchCalculator();

  const compareConfig: CompareListingsByAddressConfig = {
    defaultTimeoutMs: config.defaultTimeoutMs,
  };

  const compareWorkflow = new CompareListingsByAddressWorkflow(
    viewportSearch,
    pdpBatchService,
    serializer,
    postprocess,
    compareConfig,
    pdpExtractor,
    redfinFinder,
    propertyContent,
    redfinExtractor,
    matchCalculator
  );

  return { compareWorkflow, compareConfig };
}

function buildNovadaProxyConfigForTests(config: HttpServerConfig): NovadaProxyConfig {
  if (
    !config.novadaProxyHost ||
    !config.novadaProxyPort ||
    !config.novadaProxyUsername ||
    !config.novadaProxyPassword
  ) {
    throw new Error("Novada proxy is enabled but credentials are missing");
  }

  return {
    host: config.novadaProxyHost,
    port: config.novadaProxyPort,
    username: config.novadaProxyUsername,
    password: config.novadaProxyPassword,
    country: config.novadaCountry,
    state: config.novadaState,
    city: config.novadaCity,
    asn: config.novadaAsn,
  };
}

