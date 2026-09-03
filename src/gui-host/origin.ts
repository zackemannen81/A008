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
 *
 * An external product client — a desktop renderer loading from `file://`, or
 * one on a custom scheme — presents an origin this rule refuses. The rule is
 * not relaxed for it: admitting `null` would admit every local HTML file, and
 * `POST /v1/shell` runs a real command. Such a client is instead **named**,
 * one origin at a time, through `A008_GUI_HOST_ALLOWED_ORIGINS` (ADR 0022 D4).
 *
 * This does not make the loopback surface safe against a hostile local
 * process. It never was: any process on this machine can already speak to the
 * port. The threat model here is the user's browser, and it is unchanged.
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

export const ALLOWED_ORIGINS_ENV = "A008_GUI_HOST_ALLOWED_ORIGINS";

/**
 * Parses the operator's allowlist.
 *
 * Comma-separated, compared literally after trimming and lowercasing, because
 * the values that need naming — `null`, `file://`, `app://a008` — are not all
 * parseable as URLs and must not be normalised into something broader than
 * what was written.
 */
export function parseAllowedOrigins(
  raw: string | undefined,
): readonly string[] {
  if (raw === undefined) {
    return [];
  }
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function isAllowedOrigin(
  origin: string | undefined,
  hostHeader: string | undefined,
  allowed: readonly string[] = [],
): boolean {
  if (origin === undefined) {
    return true;
  }
  const trimmed = origin.trim();
  // Named origins are checked first and literally, so an operator can admit a
  // client whose origin the rules below would otherwise never accept.
  if (trimmed.length > 0 && allowed.includes(trimmed.toLowerCase())) {
    return true;
  }
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
