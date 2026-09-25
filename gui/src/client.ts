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
  const location = pageLocation();
  return browserHttpClient({
    fetch: fetchImpl as unknown as ClientFetch,
    ...(location === undefined ? {} : { location }),
    credentials: detectBrowserCredentials(location),
  });
}
