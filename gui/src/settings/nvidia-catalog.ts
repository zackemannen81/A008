import {
  addNvidiaModel as addNvidiaModelFromClient,
  loadKieCatalog as loadKieCatalogFromClient,
  loadNvidiaCatalog as loadNvidiaCatalogFromClient,
  loadProviderSettings as loadProviderSettingsFromClient,
  saveProviderSettings as saveProviderSettingsFromClient,
} from "../../../packages/client/src/index.js";
import type {
  KieCatalog,
  NvidiaCatalog,
  ProviderSettings,
  ProviderSettingsUpdate,
} from "../../../packages/protocol/src/index.js";
export type {
  NvidiaCatalogModel,
  NvidiaCatalog,
  ProviderSettings,
  KieCatalogModel,
  KieCatalog,
} from "../../../packages/protocol/src/index.js";
import { guiHttp } from "../client.js";

export async function loadNvidiaCatalog(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<NvidiaCatalog> {
  return loadNvidiaCatalogFromClient(guiHttp(fetchImpl), signal);
}

export async function addNvidiaModel(
  id: string,
  fetchImpl: typeof fetch = fetch,
  provider = "nvidia",
): Promise<void> {
  return addNvidiaModelFromClient(guiHttp(fetchImpl), id, provider);
}

export async function loadProviderSettings(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderSettings> {
  return loadProviderSettingsFromClient(guiHttp(fetchImpl), signal);
}

export async function loadKieCatalog(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<KieCatalog> {
  return loadKieCatalogFromClient(guiHttp(fetchImpl), signal);
}

export async function saveProviderSettings(
  body: ProviderSettingsUpdate,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderSettings> {
  return saveProviderSettingsFromClient(guiHttp(fetchImpl), body);
}
