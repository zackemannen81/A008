import {
  EMPTY_MEMORY_FILTERS,
  loadMemory as loadMemoryFromClient,
  type MemoryFilters,
} from "../../../packages/client/src/index.js";
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
import { guiHttp } from "../client.js";
export type { MemoryFilters };
export const EMPTY_FILTERS: MemoryFilters = EMPTY_MEMORY_FILTERS;
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

export async function loadMemory(
  filters: MemoryFilters,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<MemorySnapshot> {
  return loadMemoryFromClient(guiHttp(fetcher), filters, signal);
}
