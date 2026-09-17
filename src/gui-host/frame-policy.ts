/**
 * Whether a page's framing headers allow A008's sandboxed iframe to load it.
 * `frame-ancestors` and `X-Frame-Options` are set by the *target* site; A008
 * cannot override them. Report-Only CSP is ignored.
 */

export type FrameBlockReason = "frame-ancestors" | "x-frame-options";

export interface FramePolicy {
  readonly embeddable: boolean;
  readonly reason?: FrameBlockReason;
}

function headerList(headers: Headers, name: string): string[] {
  const gotten = headers.get(name);
  if (gotten && gotten.trim()) return [gotten];
  const found: string[] = [];
  headers.forEach((value, key) => {
    if (key.toLowerCase() === name && value.trim()) found.push(value);
  });
  return found;
}

function frameAncestorSources(csp: string): string[] | undefined {
  for (const directive of csp.split(";")) {
    const trimmed = directive.trim();
    if (!/^frame-ancestors\b/iu.test(trimmed)) continue;
    return trimmed
      .replace(/^frame-ancestors\b/iu, "")
      .trim()
      .split(/\s+/u)
      .filter(Boolean);
  }
  return undefined;
}

function ancestorMatches(source: string, embedder: URL, page: URL): boolean {
  const raw = source.trim();
  if (raw === "*") return true;
  const lower = raw.toLowerCase();
  if (lower === "'none'") return false;
  if (lower === "'self'") return embedder.origin === page.origin;
  if (lower === "'unsafe-inline'" || lower === "'unsafe-eval'") return false;
  try {
    if (/^[a-z][a-z0-9+.-]*:$/iu.test(raw)) {
      return embedder.protocol.toLowerCase() === lower;
    }
    const hostPart = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//iu, "");
    if (hostPart.startsWith("*.")) {
      const suffix = hostPart.slice(1).toLowerCase();
      return embedder.hostname.toLowerCase().endsWith(suffix);
    }
    const parsed = raw.includes("://")
      ? new URL(raw)
      : new URL(`${embedder.protocol}//${raw}`);
    return embedder.origin.toLowerCase() === parsed.origin.toLowerCase();
  } catch {
    return false;
  }
}

function cspAllows(
  headers: Headers,
  embedder: URL,
  page: URL,
): boolean | undefined {
  const policies = headerList(headers, "content-security-policy");
  let saw = false;
  for (const policy of policies) {
    const sources = frameAncestorSources(policy);
    if (sources === undefined) continue;
    saw = true;
    if (
      sources.length === 0 ||
      sources.some((source) => source.toLowerCase() === "'none'")
    ) {
      return false;
    }
    if (!sources.some((source) => ancestorMatches(source, embedder, page))) {
      return false;
    }
  }
  return saw ? true : undefined;
}

function xFrameAllows(
  headers: Headers,
  embedder: URL,
  page: URL,
): boolean | undefined {
  const raw = headerList(headers, "x-frame-options")[0];
  if (raw === undefined) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "deny") return false;
  if (value === "sameorigin") return embedder.origin === page.origin;
  return false;
}

export function framePolicyFromHeaders(
  headers: Headers,
  embedderOrigin: string,
  pageUrl: string,
): FramePolicy {
  let embedder: URL;
  let page: URL;
  try {
    embedder = new URL(embedderOrigin);
    page = new URL(pageUrl);
  } catch {
    return { embeddable: false, reason: "frame-ancestors" };
  }
  const csp = cspAllows(headers, embedder, page);
  if (csp === false) return { embeddable: false, reason: "frame-ancestors" };
  const xfo = xFrameAllows(headers, embedder, page);
  if (xfo === false) return { embeddable: false, reason: "x-frame-options" };
  return { embeddable: true };
}
