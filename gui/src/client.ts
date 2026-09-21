import {
  browserHttpClient,
  detectBrowserCredentials,
  type ClientFetch,
  type ClientLocation,
} from "../../packages/client/src/index.js";

function pageLocation(): ClientLocation | undefined {
  return typeof globalThis.location === "object"
    ? globalThis.location
    : undefined;
}

export function guiHttp(fetchImpl: typeof fetch = fetch) {
  return browserHttpClient({
    fetch: fetchImpl as unknown as ClientFetch,
    location: pageLocation(),
    credentials: detectBrowserCredentials(pageLocation()),
  });
}
