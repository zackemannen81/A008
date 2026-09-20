import type { McpServerCatalog } from "../../../packages/protocol/src/index.js";
import { engineHeaders } from "../session/engine-access.js";

async function errorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
    ) {
      return (body as { message: string }).message;
    }
  } catch {
    // A host error may have no JSON body.
  }
  return fallback;
}

export async function loadMcpServers(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<McpServerCatalog> {
  const response = await fetchImpl("/v1/mcp-servers", {
    headers: { ...engineHeaders(), accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok)
    throw new Error(
      await errorMessage(response, "Could not load MCP servers."),
    );
  return (await response.json()) as McpServerCatalog;
}

export async function saveMcpServers(
  servers: McpServerCatalog["servers"],
  fetchImpl: typeof fetch = fetch,
): Promise<McpServerCatalog> {
  const response = await fetchImpl("/v1/mcp-servers", {
    method: "POST",
    headers: {
      ...engineHeaders(),
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ servers }),
  });
  if (!response.ok)
    throw new Error(
      await errorMessage(response, "Could not save MCP servers."),
    );
  return (await response.json()) as McpServerCatalog;
}
