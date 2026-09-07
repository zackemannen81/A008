/** Ephemeral panel capability, supplied by the native engine client. Never persisted. */
export function engineAccessToken(): string | undefined {
  if (typeof globalThis.location !== "object") return undefined;
  const token = new URLSearchParams(globalThis.location.hash.slice(1)).get("engine");
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}

export function engineHeaders(): Record<string, string> {
  const token = engineAccessToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function engineSocketUrl(url: string): string {
  const token = engineAccessToken();
  if (!token) return url;
  const target = new URL(url);
  target.searchParams.set("access", token);
  return target.toString();
}
