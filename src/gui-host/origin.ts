/**
 * Browser-origin guard for the A008 GUI host (ADR 0019 D3).
 *
 * The host binds loopback and exposes `POST /v1/shell`, which runs a real
 * command in the host process cwd. A page on any other origin must not be able
 * to reach that endpoint or the `/v1/session` bridge, so a request that carries
 * a browser `Origin` header is accepted only when it is same-origin with the
 * host or a loopback development origin (the Vite proxy on `localhost:5173`).
 *
 * A request without an `Origin` header is a non-browser client (curl, Node
 * `fetch`, a test) and is allowed; browsers always attach `Origin` to the
 * cross-origin requests this guard exists to stop.
 */

function loopbackHostname(hostname: string): boolean {
  const bare = hostname.replace(/^\[/u, "").replace(/\]$/u, "").toLowerCase();
  return (
    bare === "localhost" ||
    bare === "::1" ||
    bare.endsWith(".localhost") ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(bare)
  );
}

export function isAllowedOrigin(
  origin: string | undefined,
  hostHeader: string | undefined,
): boolean {
  if (origin === undefined) {
    return true;
  }
  const trimmed = origin.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "null") {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  if (
    hostHeader !== undefined &&
    parsed.host.toLowerCase() === hostHeader.trim().toLowerCase()
  ) {
    return true;
  }
  return loopbackHostname(parsed.hostname);
}

export function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}
