import type { PdpDerivedData, PdpStructuredDTO } from "@/application/dto/pdp.dto";
import { ResponsePostprocessService } from "@/application/services/response-postprocess.service";

/**
 * Serializes PDP derived data into structured JSON format.
 * Single, reusable formatting point for HTTP and CLI presentation layers.
 */
export class PdpJsonSerializer {
  public serialize(derived: PdpDerivedData, postprocess: ResponsePostprocessService): PdpStructuredDTO {
    // Clean HTML texts and create sections
    const sections = (derived.htmlTexts ?? [])
      .map((html) => postprocess.cleanHtml(html))
      .filter((cleaned) => cleaned.length > 0)
      .map((content) => ({ content }));

    // Pass through PDP items as-is
    const items = derived.pdpItems ?? [];

    return {
      items,
      sections,
    };
  }
}

