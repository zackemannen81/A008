import { ChatError } from "../../core/errors.js";
import { NVIDIA_CHAT_COMPLETIONS_URL } from "./nvidia-chat-transport.js";

export const NVIDIA_MODELS_URL = NVIDIA_CHAT_COMPLETIONS_URL.replace(
  /\/chat\/completions$/u,
  "/models",
);

export interface NvidiaCatalogEntry {
  readonly id: string;
  readonly ownedBy: string;
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseNvidiaModelsPayload(
  value: unknown,
): readonly NvidiaCatalogEntry[] {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new ChatError(
      "provider",
      "NVIDIA model catalog was not an object with data[].",
    );
  }
  const entries: NvidiaCatalogEntry[] = [];
  for (const item of value.data) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      item.id.trim().length === 0
    ) {
      continue;
    }
    entries.push({
      id: item.id.trim(),
      ownedBy: typeof item.owned_by === "string" ? item.owned_by : "nvidia",
    });
  }
  return entries;
}

export async function fetchNvidiaCatalog(
  apiKey: string,
  options: { readonly fetch?: FetchLike; readonly endpoint?: string } = {},
): Promise<readonly NvidiaCatalogEntry[]> {
  const key = apiKey.trim();
  if (key.length === 0) {
    throw new ChatError(
      "configuration",
      "NVIDIA_API_KEY is required to browse NVIDIA Build models.",
    );
  }
  const endpoint = options.endpoint?.trim() || NVIDIA_MODELS_URL;
  const fetchImpl = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "GET",
      headers: {
        authorization: `Bearer ${key}`,
        accept: "application/json",
      },
    });
  } catch {
    throw new ChatError("network", "Failed to reach the NVIDIA model catalog.");
  }
  if (!response.ok) {
    throw new ChatError(
      "provider",
      `NVIDIA model catalog failed (${response.status}).`,
    );
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ChatError("provider", "NVIDIA model catalog returned non-JSON.");
  }
  return parseNvidiaModelsPayload(payload);
}
