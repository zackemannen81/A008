import {
  loadMcpHealth as loadMcpHealthFromClient,
  loadMcpServers as loadMcpServersFromClient,
  probeMcpServer as probeMcpServerFromClient,
  saveMcpServers as saveMcpServersFromClient,
} from "../../../packages/client/src/index.js";
import type {
  McpServerCatalog,
  McpServerHealth,
} from "../../../packages/protocol/src/index.js";
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

export async function loadMcpHealth(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<McpServerHealth> {
  return loadMcpHealthFromClient(guiHttp(fetchImpl), signal);
}

export async function probeMcpServer(
  name: string,
  fetchImpl: typeof fetch = fetch,
): Promise<McpServerHealth> {
  return probeMcpServerFromClient(guiHttp(fetchImpl), name);
}
