import {
  CallExternalWorkflow,
  UrlPatchService,
  BodyPatchService,
  ResponsePostprocessService,
} from "@poc/core";
import { FetchHttpAdapter } from "../services/fetch-http.adapter";
import { NodeEncodingAdapter } from "../services/encoding.adapter";

export function createCoreWorkflow() {
  const http = new FetchHttpAdapter();
  const encoder = new NodeEncodingAdapter();
  const urlPatcher = new UrlPatchService(encoder);
  const bodyPatcher = new BodyPatchService();
  const postprocess = new ResponsePostprocessService();
  const callWorkflow = new CallExternalWorkflow(http, urlPatcher, bodyPatcher, postprocess);

  return { callWorkflow, postprocess };
}

