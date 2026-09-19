import {
  zeroCostCatalogSchema,
  type ZeroCostCatalog,
} from "../../../packages/protocol/src/index.js";
import { engineHeaders } from "../session/engine-access.js";

export async function loadZeroCostCatalog(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<ZeroCostCatalog> {
  const response = await fetchImpl("/v1/catalog/zero-cost", {
    headers: { ...engineHeaders(), accept: "application/json" },
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Could not load Zero Cost Radar (${response.status}).`);
  }
  const parsed = zeroCostCatalogSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Zero Cost Radar metadata is incompatible with this GUI.");
  }
  return parsed.data;
}
