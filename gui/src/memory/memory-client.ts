export const MEMORY_KINDS = [
  "entity",
  "state",
  "history",
  "claim",
  "event",
  "utterance",
  "artifact",
  "provenance",
] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];
export interface MemoryRecord {
  readonly id: string;
  readonly sourceId: string;
  readonly kind: MemoryKind;
  readonly label: string;
  readonly status: string;
  readonly activation: string;
  readonly tags: readonly string[];
  readonly domains: readonly string[];
  readonly detail: string;
  readonly truncated: boolean;
}
export interface MemoryEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: string;
}
export interface MemorySnapshot {
  readonly protocol: "A008_MEMORY_INSPECT_V1";
  readonly projectId: string;
  readonly durable: boolean;
  readonly summary: {
    readonly total: number;
    readonly counts: Readonly<Record<MemoryKind, number>>;
    readonly active: number;
    readonly dormant: number;
    readonly contestedSlots: number;
    readonly domains: readonly {
      readonly name: string;
      readonly count: number;
    }[];
    readonly statuses: readonly string[];
  };
  readonly records: readonly MemoryRecord[];
  readonly matched: number;
  readonly offset: number;
  readonly limit: number;
  readonly graph: {
    readonly nodes: readonly MemoryRecord[];
    readonly edges: readonly MemoryEdge[];
    readonly totalNodes: number;
    readonly totalEdges: number;
  };
}
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
function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}
function count(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function record(value: unknown): boolean {
  return (
    object(value) &&
    ["id", "sourceId", "label", "status", "activation", "detail"].every(
      (key) => typeof value[key] === "string",
    ) &&
    MEMORY_KINDS.includes(value.kind as MemoryKind) &&
    strings(value.tags) &&
    strings(value.domains) &&
    typeof value.truncated === "boolean"
  );
}
export function parseMemorySnapshot(value: unknown): MemorySnapshot {
  const fail = (): never => {
    throw new Error(
      "The host returned an incompatible memory response. Restart the host with the current A008 build.",
    );
  };
  if (
    !object(value) ||
    value.protocol !== "A008_MEMORY_INSPECT_V1" ||
    typeof value.projectId !== "string" ||
    typeof value.durable !== "boolean"
  )
    return fail();
  const { summary, graph } = value;
  if (
    !object(summary) ||
    !object(summary.counts) ||
    !MEMORY_KINDS.every((kind) =>
      count((summary.counts as Record<string, unknown>)[kind]),
    ) ||
    !["total", "active", "dormant", "contestedSlots"].every((key) =>
      count(summary[key]),
    ) ||
    !strings(summary.statuses) ||
    !Array.isArray(summary.domains) ||
    !summary.domains.every(
      (d) => object(d) && typeof d.name === "string" && count(d.count),
    )
  )
    return fail();
  if (
    !["matched", "offset", "limit"].every((key) => count(value[key])) ||
    !Array.isArray(value.records) ||
    value.records.length > 100 ||
    !value.records.every(record)
  )
    return fail();
  if (
    !object(graph) ||
    !count(graph.totalNodes) ||
    !count(graph.totalEdges) ||
    !Array.isArray(graph.nodes) ||
    graph.nodes.length > 80 ||
    !graph.nodes.every(record) ||
    !Array.isArray(graph.edges) ||
    graph.edges.length > 240
  )
    return fail();
  const ids = new Set((graph.nodes as MemoryRecord[]).map((node) => node.id));
  if (
    !graph.edges.every(
      (edge) =>
        object(edge) &&
        typeof edge.relation === "string" &&
        ids.has(edge.from as string) &&
        ids.has(edge.to as string),
    )
  )
    return fail();
  return value as unknown as MemorySnapshot;
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
