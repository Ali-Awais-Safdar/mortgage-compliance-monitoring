export interface PdpDerivedData {
  htmlTexts?: string[];
  pdpItems?: Array<{ title?: string; action?: unknown }>;
}

export interface PdpStructuredDTO {
  items: Array<{ title?: string; action?: unknown }>;
  sections: Array<{ content: string }>;
}

