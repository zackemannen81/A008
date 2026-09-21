import {
  addZeroCostModel as addZeroCostModelFromClient,
  loadZeroCostCatalog as loadZeroCostFromClient,
  refreshZeroCostCatalog as refreshZeroCostFromClient,
} from "../../../packages/client/src/index.js";
import type {
  ZeroCostCatalog,
  ZeroCostModelRouteDto,
} from "../../../packages/protocol/src/index.js";
import { guiHttp } from "../client.js";

const SUPPORTED_CHAT_BASE_URLS = new Map<string, string>([
  ["nvidia", "https://integrate.api.nvidia.com/v1"],
  ["openrouter", "https://openrouter.ai/api/v1"],
  ["groq", "https://api.groq.com/openai/v1"],
  ["google", "https://generativelanguage.googleapis.com/v1beta/openai"],
  ["opencode", "https://opencode.ai/zen/v1"],
]);

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/u, "");
}

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
  if (route.apiStyle !== "openai-chat-completions") {
    return `${route.provider} ${route.apiStyle} execution is not wired in A008 yet.`;
  }
  const expected = SUPPORTED_CHAT_BASE_URLS.get(route.provider);
  if (expected === undefined) {
    return `${route.provider} execution is not wired in A008 yet.`;
  }
  if (normalizeBaseUrl(route.baseUrl) !== expected) {
    return `This ${route.provider} route does not use A008's validated provider endpoint.`;
  }
  return undefined;
}

export async function addZeroCostModel(
  route: ZeroCostModelRouteDto,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const blocked = zeroCostImportBlockReason(route);
  if (blocked) throw new Error(blocked);
  return addZeroCostModelFromClient(guiHttp(fetchImpl), route.key);
}
