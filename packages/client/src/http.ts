import type { CredentialAdapter } from "./credentials.js";
import { resolveHttpUrl } from "./origin.js";

export interface ClientResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  json(): Promise<unknown>;
}

export type ClientFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | ArrayBuffer;
    signal?: AbortSignal;
    cache?: "no-store";
    credentials?: "include" | "same-origin" | "omit";
  },
) => Promise<ClientResponse>;

export interface HttpClientOptions {
  readonly fetch: ClientFetch;
  readonly credentials: CredentialAdapter;
  readonly origin: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function messageFromBody(body: unknown, fallback: string): string {
  if (isRecord(body) && typeof body.message === "string") {
    const message = body.message.trim();
    if (message.length > 0) return message;
  }
  if (isRecord(body) && typeof body.error === "string") {
    const message = body.error.trim();
    if (message.length > 0) return message;
  }
  if (
    isRecord(body) &&
    isRecord(body.error) &&
    typeof body.error.message === "string"
  ) {
    const message = body.error.message.trim();
    if (message.length > 0) return message;
  }
  return fallback;
}

export async function readErrorMessage(
  response: ClientResponse,
  fallback: string,
  body?: unknown,
): Promise<string> {
  return messageFromBody(body, fallback);
}

export async function requestJson(
  options: HttpClientOptions,
  path: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | ArrayBuffer;
    signal?: AbortSignal;
    accept?: string;
  } = {},
): Promise<{ response: ClientResponse; body: unknown }> {
  const headers: Record<string, string> = {
    ...options.credentials.headers(),
    ...(init.accept ? { accept: init.accept } : { accept: "application/json" }),
    ...init.headers,
  };
  const requestInit: {
    method?: string;
    headers: Record<string, string>;
    body?: string | ArrayBuffer;
    signal?: AbortSignal;
    cache: "no-store";
    credentials: "include" | "same-origin" | "omit";
  } = {
    headers,
    cache: "no-store",
    credentials: options.credentials.fetchCredentials(),
  };
  if (init.method !== undefined) requestInit.method = init.method;
  if (init.body !== undefined) requestInit.body = init.body;
  if (init.signal !== undefined) requestInit.signal = init.signal;
  const response = await options.fetch(
    resolveHttpUrl(options.origin, path),
    requestInit,
  );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return { response, body };
}
