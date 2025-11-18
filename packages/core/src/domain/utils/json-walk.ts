export function* walkJson(node: unknown): Generator<unknown> {
  if (node === null || node === undefined) {
    return;
  }

  if (Array.isArray(node)) {
    for (const value of node) {
      yield* walkJson(value);
    }
    return;
  }

  if (typeof node === "object") {
    yield node;
    for (const value of Object.values(node as Record<string, unknown>)) {
      yield* walkJson(value);
    }
  }
}

