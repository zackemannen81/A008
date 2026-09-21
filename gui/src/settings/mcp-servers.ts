import {
  loadMcpServers as loadMcpServersFromClient,
  saveMcpServers as saveMcpServersFromClient,
} from "../../../packages/client/src/index.js";
import type { McpServerCatalog } from "../../../packages/protocol/src/index.js";
import { guiHttp } from "../client.js";

export async function loadMcpServers(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<McpServerCatalog> {
  return loadMcpServersFromClient(guiHttp(fetchImpl), signal);
}

export async function saveMcpServers(
  servers: McpServerCatalog["servers"],
  fetchImpl: typeof fetch = fetch,
): Promise<McpServerCatalog> {
  return saveMcpServersFromClient(guiHttp(fetchImpl), servers);
}
