import {
  MEMORY_KINDS,
  parseMemorySnapshot,
  type MemoryKind,
  type MemoryRecord,
  type MemoryEdge,
  type MemorySnapshot,
} from "../../../packages/protocol/src/index.js";
export {
  MEMORY_KINDS,
  parseMemorySnapshot,
  type MemoryKind,
  type MemoryRecord,
  type MemoryEdge,
  type MemorySnapshot,
} from "../../../packages/protocol/src/index.js";
import { engineHeaders } from "../session/engine-access.js";
export interface MemoryFilters {
  readonly query: string;
  readonly kind: string;
  readonly domain: string;
  readonly status: string;
  readonly offset: number;
}
export const EMPTY_FILTERS: MemoryFilters = {
  query: "",
  kind: "",
  domain: "",
  status: "",
  offset: 0,
};
export const KIND_LABEL: Readonly<Record<MemoryKind, string>> = {
  entity: "Entities",
  state: "Current state",
  history: "History",
  claim: "Claims",
  event: "Events",
  utterance: "Utterances",
  artifact: "Artifacts",
  provenance: "Provenance",
};

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export async function loadMemory(
  filters: MemoryFilters,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<MemorySnapshot> {
  const params = new URLSearchParams({
    limit: "40",
    offset: String(filters.offset),
  });
  for (const key of ["query", "kind", "domain", "status"] as const)
    if (filters[key]) params.set(key, filters[key]);
  const response = await fetcher(`/v1/memory?${params}`, {
    headers: engineHeaders(),
    signal,
    cache: "no-store",
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      "Memory inspection is unavailable. Check that the A008 GUI host is running.",
    );
  }
  if (!response.ok) {
    const error = object(body) ? body.error : undefined;
    throw new Error(
      object(error) && typeof error.message === "string"
        ? error.message
        : typeof error === "string"
          ? error
          : `Memory inspection failed (HTTP ${response.status}).`,
    );
  }
  return parseMemorySnapshot(body);
}
