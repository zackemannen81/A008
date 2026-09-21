import { loadZeroCostCatalog as loadZeroCostFromClient } from "../../../packages/client/src/index.js";
import type { ZeroCostCatalog } from "../../../packages/protocol/src/index.js";
import { guiHttp } from "../client.js";

export async function loadZeroCostCatalog(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<ZeroCostCatalog> {
  return loadZeroCostFromClient(guiHttp(fetchImpl), signal);
}
