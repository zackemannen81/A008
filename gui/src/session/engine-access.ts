import {
  detectBrowserCredentials,
  engineCapabilityFromHash,
} from "../../../packages/client/src/index.js";

/** Ephemeral panel capability, supplied by the native engine client. Never persisted. */
export function engineAccessToken(): string | undefined {
  if (typeof globalThis.location !== "object") return undefined;
  return engineCapabilityFromHash(globalThis.location.hash);
}

export function engineHeaders(): Record<string, string> {
  if (typeof globalThis.location !== "object") return {};
  return detectBrowserCredentials(globalThis.location).headers();
}

export function engineSocketUrl(url: string): string {
  if (typeof globalThis.location !== "object") return url;
  return detectBrowserCredentials(globalThis.location).applySocketUrl(url);
}

const PIN_AUTH_REQUIRED = "Authentication required.";
let authRecoveryInstalled = false;
let authRedirectStarted = false;

export interface AuthRecoveryLocation {
  readonly href: string;
  readonly origin: string;
  readonly hash?: string;
  replace(url: string): void;
}
export async function fetchWithAuthRecovery(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fetchImpl: typeof fetch,
  location: AuthRecoveryLocation,
  onPinAuthRequired: () => void,
): Promise<Response> {
  const response = await fetchImpl(input, init);
  if (response.status !== 401) return response;
  if (hasEngineCapability(location.hash ?? "")) return response;

  const url = requestUrl(input, location.href);
  if (
    url === undefined ||
    url.origin !== location.origin ||
    !url.pathname.startsWith("/v1/")
  ) {
    return response;
  }

  const body = (await response
    .clone()
    .json()
    .catch(() => undefined)) as unknown;
  if (
    isRecord(body) &&
    body.error === PIN_AUTH_REQUIRED &&
    body.message === PIN_AUTH_REQUIRED
  ) {
    onPinAuthRequired();
  }
  return response;
}

export function installAuthRecovery(): void {
  if (
    authRecoveryInstalled ||
    typeof globalThis.fetch !== "function" ||
    typeof globalThis.location !== "object"
  )
    return;
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const location = globalThis.location;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    fetchWithAuthRecovery(input, init, nativeFetch, location, () => {
      if (authRedirectStarted) return;
      authRedirectStarted = true;
      location.replace("/");
    })) as typeof fetch;
  authRecoveryInstalled = true;
}
function hasEngineCapability(hash: string): boolean {
  const token = new URLSearchParams(
    hash.startsWith("#") ? hash.slice(1) : hash,
  ).get("engine");
  return token !== null && /^[a-f0-9]{64}$/.test(token);
}

function requestUrl(
  input: RequestInfo | URL,
  baseHref: string,
): URL | undefined {
  try {
    if (input instanceof URL) return input;
    if (typeof Request !== "undefined" && input instanceof Request)
      return new URL(input.url);
    return new URL(String(input), baseHref);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
