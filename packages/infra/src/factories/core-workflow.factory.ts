import {
  CallExternalWorkflow,
  UrlPatchService,
  BodyPatchService,
  ResponsePostprocessService,
  type HttpPort,
} from "@poc/core";
import { FetchHttpAdapter } from "../services/fetch-http.adapter";
import { NodeEncodingAdapter } from "../services/encoding.adapter";

export function createCoreWorkflow(deps?: { http?: HttpPort }) {
  const http = deps?.http ?? new FetchHttpAdapter();
  const encoder = new NodeEncodingAdapter();
  const urlPatcher = new UrlPatchService(encoder);
  const bodyPatcher = new BodyPatchService();
  const postprocess = new ResponsePostprocessService();
  const callWorkflow = new CallExternalWorkflow(http, urlPatcher, bodyPatcher, postprocess);

  return { callWorkflow, postprocess };
}

