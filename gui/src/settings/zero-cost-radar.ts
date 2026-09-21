import {
  addNvidiaModel as addNvidiaModelFromClient,
  loadZeroCostCatalog as loadZeroCostFromClient,
  refreshZeroCostCatalog as refreshZeroCostFromClient,
} from "../../../packages/client/src/index.js";
import type {
  ZeroCostCatalog,
  ZeroCostModelRouteDto,
} from "../../../packages/protocol/src/index.js";
import { guiHttp } from "../client.js";

const NVIDIA_CHAT_BASE_URL = "https://integrate.api.nvidia.com/v1";

export async function loadZeroCostCatalog(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<ZeroCostCatalog> {
  return loadZeroCostFromClient(guiHttp(fetchImpl), signal);
}

export async function refreshZeroCostCatalog(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<ZeroCostCatalog> {
  return refreshZeroCostFromClient(guiHttp(fetchImpl), signal);
}
export function zeroCostImportBlockReason(
  route: ZeroCostModelRouteDto,
): string | undefined {
  if (route.provider !== "nvidia") {
    return `${route.provider} execution is not wired in A008 yet.`;
  }
  if (
    route.apiStyle !== "openai-chat-completions" ||
    route.baseUrl !== NVIDIA_CHAT_BASE_URL
  ) {
    return "This NVIDIA route does not use A008's current NVIDIA chat path.";
  }
  return undefined;
}

export async function addZeroCostModel(
  route: ZeroCostModelRouteDto,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const blocked = zeroCostImportBlockReason(route);
  if (blocked) throw new Error(blocked);
  return addNvidiaModelFromClient(
    guiHttp(fetchImpl),
    route.modelId,
    "nvidia",
    route.name,
  );
}
