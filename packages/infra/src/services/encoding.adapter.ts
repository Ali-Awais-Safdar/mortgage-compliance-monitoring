import type { EncodingPort } from "@poc/core";

export class NodeEncodingAdapter implements EncodingPort {
  base64(input: string): string {
    return Buffer.from(input, "utf-8").toString("base64");
  }
}

