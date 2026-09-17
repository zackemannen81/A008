import type {
  NvidiaCatalog,
  ProviderSettings,
  KieCatalog,
  ProviderSettingsUpdate,
} from "../../../packages/protocol/src/index.js";
export type {
  NvidiaCatalogModel,
  NvidiaCatalog,
  ProviderSettings,
  KieCatalogModel,
  KieCatalog,
} from "../../../packages/protocol/src/index.js";
import { engineHeaders } from "../session/engine-access.js";

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
    throw new Error(
      await errorMessage(response, "Could not load the NVIDIA catalog."),
    );
  }
  return (await response.json()) as NvidiaCatalog;
}

export async function addNvidiaModel(
  id: string,
  fetchImpl: typeof fetch = fetch,
  provider = "nvidia",
): Promise<void> {
  const response = await fetchImpl("/v1/catalog/nvidia", {
    method: "POST",
    headers: {
      ...engineHeaders(),
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ id, provider }),
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
    throw new Error(
      await errorMessage(response, "Could not load provider settings."),
    );
  }
  return (await response.json()) as ProviderSettings;
}

export async function loadKieCatalog(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<KieCatalog> {
  const response = await fetchImpl("/v1/catalog/kie", {
    headers: { ...engineHeaders(), accept: "application/json" },
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      await errorMessage(response, "Could not load the kie.ai catalog."),
    );
  }
  return (await response.json()) as KieCatalog;
}

export async function saveProviderSettings(
  body: ProviderSettingsUpdate,
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
    throw new Error(
      await errorMessage(response, "Could not save provider settings."),
    );
  }
  return (await response.json()) as ProviderSettings;
}

async function errorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
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
