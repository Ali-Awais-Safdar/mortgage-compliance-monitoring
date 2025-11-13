import {
  GetPdpFromAddressWorkflow,
  PdpOutputComposer,
  ResponsePostprocessService,
} from "@poc/core";
import {
  StaticAddressResolverAdapter,
  createCoreWorkflow,
} from "@poc/infra";
import type { HttpServerConfig } from "./config/env.config";

export interface AppContainer {
  workflow: GetPdpFromAddressWorkflow;
  composer: PdpOutputComposer;
  postprocess: ResponsePostprocessService;
  defaultTimeoutMs?: number;
}

export function createContainer(config: HttpServerConfig): AppContainer {
  // Build dependencies using factory
  const { callWorkflow, postprocess } = createCoreWorkflow();
  const addressResolver = new StaticAddressResolverAdapter();

  const workflow = new GetPdpFromAddressWorkflow(
    callWorkflow,
    addressResolver,
    {
      airbnbSearchUrl: config.airbnbSearchUrl,
      airbnbUrl: config.airbnbUrl,
      airbnbSearchBody: config.airbnbSearchBody,
      apiKey: config.apiKey,
      defaultTimeoutMs: config.defaultTimeoutMs,
    }
  );

  const composer = new PdpOutputComposer();

  return {
    workflow,
    composer,
    postprocess,
    defaultTimeoutMs: config.defaultTimeoutMs,
  };
}

