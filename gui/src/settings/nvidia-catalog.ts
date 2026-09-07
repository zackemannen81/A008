import { engineHeaders } from "../session/engine-access.js";

export interface NvidiaCatalogModel {
  readonly id: string;
  readonly ownedBy: string;
  readonly added: boolean;
}

export interface NvidiaCatalog {
  readonly source: string;
  readonly browse: string;
  readonly note: string;
  readonly models: readonly NvidiaCatalogModel[];
}

export interface ProviderSettings {
  readonly nvidiaApiKeyConfigured: boolean;
  readonly imageModel: string;
  readonly imageEndpoint: string;
  readonly keySource: string;
}

export async function loadNvidiaCatalog(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<NvidiaCatalog> {
  const response = await fetchImpl("/v1/catalog/nvidia", {
    headers: { ...engineHeaders(), accept: "application/json" },
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Could not load the NVIDIA catalog."));
  }
  return (await response.json()) as NvidiaCatalog;
}

export async function addNvidiaModel(id: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const response = await fetchImpl("/v1/catalog/nvidia", {
    method: "POST",
    headers: {
      ...engineHeaders(),
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Could not add that model."));
  }
}

export async function loadProviderSettings(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderSettings> {
  const response = await fetchImpl("/v1/provider-settings", {
    headers: { ...engineHeaders(), accept: "application/json" },
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Could not load provider settings."));
  }
  return (await response.json()) as ProviderSettings;
}

export async function saveProviderSettings(
  body: { nvidiaApiKey?: string; imageModel?: string; imageEndpoint?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderSettings> {
  const response = await fetchImpl("/v1/provider-settings", {
    method: "POST",
    headers: {
      ...engineHeaders(),
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Could not save provider settings."));
  }
  return (await response.json()) as ProviderSettings;
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (payload as { message: unknown }).message === "string"
    ) {
      return (payload as { message: string }).message;
    }
  } catch {
    /* host may return empty */
  }
  return fallback;
}
