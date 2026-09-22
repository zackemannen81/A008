import {
  createPlatformV3Client,
  detectBrowserCredentials,
  type ClientFetch,
  type ClientLocation,
  type CredentialAdapter,
  type HttpClientOptions,
  type PlatformV3Client,
} from "../../../packages/client/src/index.js";

function pageLocation(): ClientLocation | undefined {
  return typeof globalThis.location === "object" ? globalThis.location : undefined;
}

/**
 * Injected fetch and credential adapter, same style as `createGuiSessionClient`.
 * The returned options hold the adapter; callers do not copy a bearer token.
 */
export function createPlatformHttp(options?: {
  readonly fetch?: ClientFetch;
  readonly credentials?: CredentialAdapter;
  readonly location?: ClientLocation;
  readonly origin?: string;
}): HttpClientOptions {
  const location = options?.location ?? pageLocation();
  return {
    fetch: options?.fetch ?? (globalThis.fetch as unknown as ClientFetch),
    origin: options?.origin ?? "",
    credentials: options?.credentials ?? detectBrowserCredentials(location),
  };
}

export function createPlatformResourceClient(
  http: HttpClientOptions,
): PlatformV3Client {
  return createPlatformV3Client(http);
}
