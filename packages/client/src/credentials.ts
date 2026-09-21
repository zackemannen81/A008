export type CredentialKind = "cookie" | "bearer" | "engine";

export interface CredentialAdapter {
  readonly kind: CredentialKind;
  headers(): Record<string, string>;
  applySocketUrl(url: string): string;
  fetchCredentials(): "include" | "same-origin" | "omit";
}

const ENGINE_TOKEN = /^[a-f0-9]{64}$/u;

export function cookieCredentials(): CredentialAdapter {
  return {
    kind: "cookie",
    headers: () => ({}),
    applySocketUrl: (url) => url,
    fetchCredentials: () => "same-origin",
  };
}

export function bearerCredentials(credential: string): CredentialAdapter {
  const value = credential.trim();
  if (value.length === 0) {
    throw new Error("Device credential must not be empty.");
  }
  return {
    kind: "bearer",
    headers: () => ({ authorization: `Bearer ${value}` }),
    applySocketUrl: (url) => url,
    fetchCredentials: () => "omit",
  };
}

export function engineCapabilityFromHash(hash: string | undefined): string | undefined {
  if (hash === undefined || hash.length === 0) return undefined;
  const token = new URLSearchParams(
    hash.startsWith("#") ? hash.slice(1) : hash,
  ).get("engine");
  return token && ENGINE_TOKEN.test(token) ? token : undefined;
}

export function engineCredentials(token: string): CredentialAdapter {
  if (!ENGINE_TOKEN.test(token)) {
    throw new Error("Engine capability token is malformed.");
  }
  return {
    kind: "engine",
    headers: () => ({ authorization: `Bearer ${token}` }),
    applySocketUrl: (url) => {
      const target = new URL(url);
      target.searchParams.set("access", token);
      return target.toString();
    },
    fetchCredentials: () => "omit",
  };
}

export function detectBrowserCredentials(location?: {
  readonly hash?: string;
}): CredentialAdapter {
  const token = engineCapabilityFromHash(location?.hash);
  return token ? engineCredentials(token) : cookieCredentials();
}
