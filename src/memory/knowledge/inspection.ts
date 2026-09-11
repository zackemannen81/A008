import { evaluateAssociation } from "./association-lifecycle.js";
import { evaluateLifecycle } from "./lifecycle.js";
import { MemoryError } from "../errors.js";
import { normalizeLabel } from "./labels.js";
import { slotKey } from "./registry.js";
import type { KnowledgeReadContext } from "./read-types.js";

export const INSPECTION_KINDS = [
  "entity",
  "state",
  "history",
  "claim",
  "event",
  "utterance",
  "artifact",
  "provenance",
] as const;
export type InspectionKind = (typeof INSPECTION_KINDS)[number];
export interface MemoryInspectionQuery {
  readonly query?: string;
  readonly kind?: InspectionKind;
  readonly domain?: string;
  readonly status?: string;
  readonly offset?: number;
  readonly limit?: number;
}
export interface MemoryInspectionRecord {
  readonly id: string;
  readonly sourceId: string;
  readonly kind: InspectionKind;
  readonly label: string;
  readonly status: string;
  readonly activation: string;
  readonly tags: readonly string[];
  readonly domains: readonly string[];
  readonly detail: string;
  readonly truncated: boolean;
}
export interface MemoryInspectionEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: string;
}
export interface MemoryInspection {
  readonly protocol: "A008_MEMORY_INSPECT_V1";
  readonly projectId: string;
  readonly durable: boolean;
  readonly summary: {
    readonly total: number;
    readonly counts: Readonly<Record<InspectionKind, number>>;
    readonly active: number;
    readonly dormant: number;
    readonly contestedSlots: number;
    readonly domains: readonly {
      readonly name: string;
      readonly count: number;
    }[];
    readonly statuses: readonly string[];
  };
  readonly records: readonly MemoryInspectionRecord[];
  readonly matched: number;
  readonly offset: number;
  readonly limit: number;
  readonly graph: {
    readonly nodes: readonly MemoryInspectionRecord[];
    readonly edges: readonly MemoryInspectionEdge[];
    readonly totalNodes: number;
    readonly totalEdges: number;
  };
}

/** Both HTTP and ACP validate before touching the runtime. No coercion at ACP. */
export function parseMemoryInspectionQuery(
  value: unknown,
): MemoryInspectionQuery {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    invalid("Expected an inspection query object.");
  const input = value as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!["query", "kind", "domain", "status", "offset", "limit"].includes(key))
      invalid(`Unknown inspection field: ${key}`);
  }
  for (const key of ["query", "domain", "status"] as const) {
    if (
      input[key] !== undefined &&
      (typeof input[key] !== "string" || input[key].length > 300)
    )
      invalid(`${key} must be a string of at most 300 characters.`);
  }
  if (
    input.kind !== undefined &&
    !INSPECTION_KINDS.includes(input.kind as InspectionKind)
  )
    invalid("Unknown memory record kind.");
  for (const [key, min, max] of [
    ["offset", 0, 1_000_000],
    ["limit", 1, 100],
  ] as const) {
    const n = input[key];
    if (
      n !== undefined &&
      (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max)
    )
      invalid(`${key} must be an integer from ${min} to ${max}.`);
  }
  return {
    ...(input.query === undefined
      ? {}
      : { query: (input.query as string).trim() }),
    ...(input.domain === undefined
      ? {}
      : { domain: normalizeLabel(input.domain as string) }),
    ...(input.status === undefined
      ? {}
      : { status: (input.status as string).trim() }),
    ...(input.kind === undefined ? {} : { kind: input.kind as InspectionKind }),
    offset: (input.offset as number | undefined) ?? 0,
    limit: (input.limit as number | undefined) ?? 40,
  };
}

function invalid(message: string): never {
  throw new MemoryError("invalid_input", message);
}

/** Inventory, not retrieval. Every operation below is a defensive read. */
export function inspectKnowledge(
  context: KnowledgeReadContext,
  identity: { projectId: string; durable: boolean },
  input: MemoryInspectionQuery = {},
): MemoryInspection {
  const query = parseMemoryInspectionQuery(input);
  const records: MemoryInspectionRecord[] = [];
  const searchable = new Map<string, string>();
  const counts = Object.fromEntries(
    INSPECTION_KINDS.map((kind) => [kind, 0]),
  ) as Record<InspectionKind, number>;
  const state = context.state.snapshot();
  const evaluatedAt = context.lifecycle.now();
  const snapshot = context.lifecycle.snapshot();
  const lifecycle = { ...snapshot, records: snapshot.records.map(r => {
    const evaluated = evaluateLifecycle(r.lifecycle, evaluatedAt);
    return { ...r, lifecycle: { ...r.lifecycle, state: evaluated.memoryState, effectiveStrength: evaluated.strength, evaluatedAt, baselineState: r.lifecycle.state, thresholdCrossingAt: evaluated.thresholdCrossingAt } };
  }) };
  const lifeById = new Map(
    lifecycle.records.map((record) => [record.evidenceId, record.lifecycle]),
  );
  const labelById = new Map(
    context.labels.list().map((record) => [record.recordId, record]),
  );
  const edges: MemoryInspectionEdge[] = [];
  const directProvenanceEdges = new Set<string>();
  const artifacts = context.evidence.listArtifacts();
  const artifactIds = new Set<string>(artifacts.map((artifact) => artifact.id));
  const key = (kind: string, id: string): string => `${kind}:${id}`;
  const link = (from: string, to: string, relation: string): void => {
    edges.push({ from, to, relation });
  };
  const add = (
    kind: InspectionKind,
    sourceId: string,
    label: string,
    status: string,
    data: unknown,
    labelId = sourceId,
  ): string => {
    const id = key(kind, sourceId);
    const labels = labelById.get(labelId);
    const life =
      kind === "state" || kind === "history"
        ? undefined
        : lifeById.get(sourceId);
    const full = JSON.stringify(
      {
        record: data,
        ...(() => {
          const associations = context.relations.neighbors(sourceId).flatMap(hop => hop.association ? [{ ...hop.association, evaluated: evaluateAssociation(hop.association, evaluatedAt) }] : []);
          return associations.length ? { associations } : {};
        })(),
        ...(labels === undefined ? {} : { labels }),
        ...(life === undefined ? {} : { lifecycle: life }),
      },
      null,
      2,
    );
    if (query.query) searchable.set(id, normalizeLabel(full));
    records.push({
      id,
      sourceId,
      kind,
      label: label.slice(0, 500),
      status,
      activation: life?.state ?? "untracked",
      tags: [...(labels?.tags ?? [])],
      domains: [...(labels?.domains ?? [])],
      detail: full.slice(0, 16_000),
      truncated: full.length > 16_000 || label.length > 500,
    });
    counts[kind] += 1;
    return id;
  };

  for (const entity of context.entities.list())
    add(
      "entity",
      entity.id,
      entity.labels.join(" · ") || entity.id,
      entity.type,
      entity,
    );
  for (const artifact of artifacts)
    add(
      "artifact",
      artifact.id,
      artifact.locator,
      artifact.contentKind,
      artifact,
    );
  for (const utterance of context.evidence.listUtterances()) {
    const id = add(
      "utterance",
      utterance.id,
      utterance.content,
      utterance.act,
      utterance,
    );
    link(id, key("artifact", utterance.artifactId), "artifact");
  }
  const claims = context.evidence.listClaims();
  const evidenceClaimIds = new Set(claims.map((claim) => String(claim.id)));
  for (const claim of claims) {
    const id = add("claim", claim.id, claim.label, claim.status, claim);
    directProvenanceEdges.add(
      JSON.stringify([
        key("claim", claim.id),
        key(claim.derivedFrom.kind, claim.derivedFrom.id),
        "derived_from",
      ]),
    );
  }
  // Some migrated/state-machine claims have no separate evidence claim.
  for (const claim of state.claims) {
    if (!evidenceClaimIds.has(claim.id))
      add("claim", claim.id, claim.label, claim.status, claim);
  }
  for (const event of state.events)
    add("event", event.id, event.label, event.type, event);
  for (const binding of state.bindings) {
    const kind = binding.interval.to === null ? "state" : "history";
    const sourceId = JSON.stringify([
      slotKey(binding.slot),
      binding.interval,
      binding.claimId,
    ]);
    const id = add(
      kind,
      sourceId,
      binding.label,
      state.contestedSlotKeys.includes(slotKey(binding.slot))
        ? "contested"
        : kind === "state"
          ? "current"
          : "closed",
      binding,
      binding.claimId,
    );
    link(id, key("claim", binding.claimId), "established_by");
    const owner =
      binding.slot.kind === "attribute"
        ? binding.slot.entity
        : binding.slot.subject;
    const ownerKind = artifactIds.has(owner) ? "artifact" : "entity";
    link(key(ownerKind, owner), id, binding.slot.name);
    if (binding.kind === "relationship") {
      const targetKind = artifactIds.has(binding.object)
        ? "artifact"
        : "entity";
      link(id, key(targetKind, binding.object), "object");
    }
  }
  for (const provenance of context.evidence.listProvenance()) {
    const id = add(
      "provenance",
      provenance.id,
      `${provenance.fromLabel} → ${provenance.toLabel}`,
      provenance.relation,
      provenance,
    );
    link(id, key(provenance.fromKind, provenance.fromId), "from");
    link(id, key(provenance.toKind, provenance.toId), "to");
    const directEdge = JSON.stringify([
      key(provenance.fromKind, provenance.fromId),
      key(provenance.toKind, provenance.toId),
      provenance.relation,
    ]);
    if (!directProvenanceEdges.has(directEdge)) {
      link(
        key(provenance.fromKind, provenance.fromId),
        key(provenance.toKind, provenance.toId),
        provenance.relation,
      );
    }
  }
  const bySource = new Map(
    records.map((record) => [record.sourceId, record.id]),
  );
  for (const record of records) {
    const displayed = new Set<string>();
    for (const hop of context.relations.neighbors(record.sourceId)) {
      const target = bySource.get(hop.to);
      const edgeKey = JSON.stringify([hop.to, hop.relation]);
      // Applicability variants remain distinct in stored detail, but share one graph line.
      if (target !== undefined && !displayed.has(edgeKey)) {
        link(record.id, target, hop.relation);
        displayed.add(edgeKey);
      }
    }
  }
  const domains = new Map<string, number>();
  // Count actual label attachments once, not the bindings that display claim labels.
  for (const labels of labelById.values())
    for (const name of labels.domains)
      domains.set(name, (domains.get(name) ?? 0) + 1);
  const needle = normalizeLabel(query.query ?? "");
  const matches = records
    .filter(
      (record) =>
        (query.kind === undefined || record.kind === query.kind) &&
        (!query.domain || record.domains.includes(query.domain)) &&
        (!query.status ||
          record.status === query.status ||
          record.activation === query.status) &&
        (!needle ||
          normalizeLabel(`${record.label} ${record.sourceId}`).includes(
            needle,
          ) ||
          searchable.get(record.id)?.includes(needle)),
    )
    .sort(
      (a, b) =>
        a.kind.localeCompare(b.kind) ||
        a.label.localeCompare(b.label) ||
        a.id.localeCompare(b.id),
    );
  const matchedIds = new Set(matches.map((record) => record.id));
  const deduped = [
    ...new Map(
      edges
        .filter((edge) => matchedIds.has(edge.from) && matchedIds.has(edge.to))
        .map((edge) => [JSON.stringify(edge), edge]),
    ).values(),
  ];
  // Traverse stored links so a bounded graph remains connected where possible.
  const adjacency = new Map<string, Set<string>>();
  for (const edge of deduped) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, new Set());
    adjacency.get(edge.from)!.add(edge.to);
    adjacency.get(edge.to)!.add(edge.from);
  }
  const seeds = [...matches].sort(
    (a, b) =>
      (adjacency.get(b.id)?.size ?? 0) - (adjacency.get(a.id)?.size ?? 0) ||
      a.id.localeCompare(b.id),
  );
  const selected = new Set<string>();
  for (const seed of seeds) {
    const queue = [seed.id];
    for (let i = 0; i < queue.length && selected.size < 80; i += 1) {
      const id = queue[i]!;
      if (selected.has(id)) continue;
      selected.add(id);
      queue.push(...(adjacency.get(id) ?? []));
    }
    if (selected.size >= 80) break;
  }
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 40;
  return {
    protocol: "A008_MEMORY_INSPECT_V1",
    ...identity,
    summary: {
      total: records.length,
      counts,
      active: lifecycle.records.filter((r) => r.lifecycle.state === "active")
        .length,
      dormant: lifecycle.records.filter((r) => r.lifecycle.state === "dormant")
        .length,
      contestedSlots: state.contestedSlotKeys.length,
      domains: [...domains]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      statuses: [...new Set(records.map((record) => record.status))].sort(),
    },
    records: matches.slice(offset, offset + limit),
    matched: matches.length,
    offset,
    limit,
    graph: {
      nodes: matches.filter((record) => selected.has(record.id)),
      edges: deduped
        .filter((edge) => selected.has(edge.from) && selected.has(edge.to))
        .slice(0, 240),
      totalNodes: matches.length,
      totalEdges: deduped.length,
    },
  };
}
