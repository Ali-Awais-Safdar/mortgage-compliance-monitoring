export type JsonRecord = Record<string, unknown>;
export type Indexable = JsonRecord | unknown[];
export type IndexKey = string | number;

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isIndexable(value: unknown): value is Indexable {
  return isJsonRecord(value) || Array.isArray(value);
}

export function isArrayIndex(segment: string): boolean {
  return /^\d+$/.test(segment);
}

export function toIndexKey(segment: string): IndexKey {
  return isArrayIndex(segment) ? Number.parseInt(segment, 10) : segment;
}

export function readChild(container: Indexable, key: IndexKey): unknown {
  if (Array.isArray(container) && typeof key === "number") {
    return container[key];
  }

  if (!Array.isArray(container)) {
    return container[String(key)];
  }

  return undefined;
}

export function writeChild(container: Indexable, key: IndexKey, value: unknown): void {
  if (Array.isArray(container) && typeof key === "number") {
    container[key] = value;
    return;
  }

  if (!Array.isArray(container)) {
    container[String(key)] = value;
  }
}

export function ensureContainer(container: Indexable, key: IndexKey, nextSegment?: string): Indexable {
  const existing = readChild(container, key);
  if (isIndexable(existing)) {
    return existing;
  }

  const shouldBeArray = nextSegment ? isArrayIndex(nextSegment) : false;
  const nextValue: Indexable = shouldBeArray ? [] : {};
  writeChild(container, key, nextValue);
  return nextValue;
}

export function getValueAtPath(target: Indexable, path: string): unknown {
  const segments = path.split(".").filter(Boolean);
  let current: unknown = target;

  for (const segment of segments) {
    if (!isIndexable(current)) {
      return undefined;
    }

    const key = toIndexKey(segment);
    current = readChild(current, key);
    if (current === undefined) {
      return undefined;
    }
  }

  return current;
}

export function setAtPath(target: Indexable, path: string, value: unknown): void {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  let current: Indexable = target;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (!segment) {
      continue;
    }

    const key = toIndexKey(segment);
    const nextSegment = segments[i + 1];
    current = ensureContainer(current, key, nextSegment);
  }

  const finalSegment = segments[segments.length - 1];
  if (!finalSegment) {
    return;
  }

  const finalKey = toIndexKey(finalSegment);
  writeChild(current, finalKey, value);
}

export function coercePreservingType(existingValue: unknown, provided: unknown): unknown {
  if (existingValue === undefined || existingValue === null) {
    return provided;
  }

  if (typeof existingValue === "string") {
    return String(provided);
  }

  if (typeof existingValue === "number") {
    const numberValue = typeof provided === "number" ? provided : Number.parseFloat(String(provided));
    if (!Number.isNaN(numberValue)) {
      return numberValue;
    }
  }

  return provided;
}

