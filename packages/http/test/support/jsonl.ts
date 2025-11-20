export async function readJsonLines<T>(path: string): Promise<T[]> {
  const text = await Bun.file(path).text();

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line, idx) => {
      try {
        return JSON.parse(line) as T;
      } catch (err) {
        throw new Error(`Invalid JSONL at ${path}:${idx + 1} - ${(err as Error).message}`);
      }
    });
}

