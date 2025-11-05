/**
 * Lightweight env reader. Bun auto-loads .env; you can also pass --env-file.
 * Prefer reading from Bun.env (or process.env).
 */
export const readEnv = (name: string, fallback?: string): string | undefined => {
  return Bun?.env?.[name] ?? process.env[name] ?? fallback;
};
