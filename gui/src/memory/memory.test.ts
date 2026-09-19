import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EMPTY_FILTERS,
  loadMemory,
  MEMORY_KINDS,
  parseMemorySnapshot,
  type MemoryRecord,
  type MemorySnapshot,
} from "./memory-client.js";
import { isFocusSubdued, layoutGraph, MemoryGraph } from "./memory-graph.js";
import { MemoryInspector, storedConnections } from "./memory-inspector.js";
import {
  edgePath,
  layoutLabels,
  parallelEdgeCounts,
} from "./memory-graph-layout.js";
import { MemoryOverview } from "./memory-overview.js";

const record: MemoryRecord = {
  id: "claim:fixture",
  sourceId: "fixture",
  kind: "claim",
  label: "<script>alert('x')</script>",
  status: "asserted",
  activation: "dormant",
  tags: ["memory"],
  domains: ["runtime"],
  detail: '{"content":"<script>not executable</script>"}',
  truncated: false,
};
function snapshot(): MemorySnapshot {
  return {
    protocol: "A008_MEMORY_INSPECT_V1",
    projectId: "test-project",
    durable: false,
    summary: {
      total: 1,
      counts: {
        entity: 0,
        state: 0,
        history: 0,
        claim: 1,
        event: 0,
        utterance: 0,
        artifact: 0,
        provenance: 0,
      },
      active: 0,
      dormant: 1,
      contestedSlots: 0,
      domains: [{ name: "runtime", count: 1 }],
      statuses: ["asserted"],
    },
    records: [record],
    matched: 1,
    offset: 0,
    limit: 40,
    graph: { nodes: [record], edges: [], totalNodes: 1, totalEdges: 0 },
  };
}
test("memory response rejects incompatible hosts and dangling graph endpoints", () => {
  assert.deepEqual(parseMemorySnapshot(snapshot()), snapshot());
  for (const value of [
    {},
    { ...snapshot(), protocol: "older" },
    { ...snapshot(), records: [{}] },
    {
      ...snapshot(),
      graph: {
        ...snapshot().graph,
        edges: [{ from: record.id, to: "missing", relation: "invented" }],
      },
    },
    { ...snapshot(), summary: { ...snapshot().summary, total: -1 } },
  ])
    assert.throws(() => parseMemorySnapshot(value), /incompatible/u);
});
test("memory client encodes filters and uses a cancellable no-store read", async () => {
  let url = "";
  let options: RequestInit | undefined;
  const controller = new AbortController();
  const fetcher: typeof fetch = async (input, init) => {
    url = String(input);
    options = init;
    return new Response(JSON.stringify(snapshot()), {
      headers: { "content-type": "application/json" },
    });
  };
  await loadMemory(
    { ...EMPTY_FILTERS, query: "å & memory", offset: 40 },
    controller.signal,
    fetcher,
  );
  assert.equal(
    new URL(url, "http://localhost").searchParams.get("query"),
    "å & memory",
  );
  assert.equal(
    new URL(url, "http://localhost").searchParams.get("offset"),
    "40",
  );
  assert.equal(options?.cache, "no-store");
  assert.equal(options?.signal, controller.signal);
  await assert.rejects(
    loadMemory(
      EMPTY_FILTERS,
      controller.signal,
      async () =>
        new Response(
          JSON.stringify({ error: { message: "fixture unavailable" } }),
          { status: 503 },
        ),
    ),
    /fixture unavailable/u,
  );
  await assert.rejects(
    loadMemory(
      EMPTY_FILTERS,
      controller.signal,
      async () => new Response("<html>"),
    ),
    /unavailable/u,
  );
});
test("overview reports actual surface and evidence values", () => {
  const html = renderToStaticMarkup(
    createElement(MemoryOverview, { snapshot: snapshot(), onBrowse() {} }),
  );
  assert.match(html, /0 active evidence records/u);
  assert.match(html, /runtime/u);
  assert.match(html, /Viewing a record does not accept or reinforce it/u);
  for (const kind of MEMORY_KINDS)
    assert.ok(html.includes(`memory-kind-${kind}`));
});
test("inspector escapes untrusted content and exposes acceptance separately from activation", () => {
  const html = renderToStaticMarkup(
    createElement(MemoryInspector, { record, onClose() {} }),
  );
  assert.equal(html.includes("<script>"), false);
  assert.match(html, /&lt;script&gt;/u);
  assert.match(html, /asserted/u);
  assert.match(html, /dormant/u);
  assert.match(html, /memory-chip/u);
  assert.match(html, /runtime/u);
  const state = renderToStaticMarkup(
    createElement(MemoryInspector, {
      record: {
        ...record,
        kind: "state",
        activation: "untracked",
        truncated: true,
      },
      onClose() {},
    }),
  );
  assert.match(state, /Not tracked on this record/u);
  assert.match(state, /truncated/u);
});
test("graph is deterministic and keyboard inspectable without invented links", () => {
  assert.deepEqual(layoutGraph([record], []), layoutGraph([record], []));
  const html = renderToStaticMarkup(
    createElement(MemoryGraph, {
      graph: snapshot().graph,
      selected: undefined,
      onSelect() {},
    }),
  );
  assert.match(html, /role="button"/u);
  assert.match(html, /tabindex="0"/u);
  assert.match(html, /No stored links connect/u);
  assert.match(html, /Focus mode/u);
  assert.equal(html.includes("<line"), false);
  const bounded = renderToStaticMarkup(
    createElement(MemoryGraph, {
      graph: { ...snapshot().graph, totalNodes: 100 },
      selected: undefined,
      onSelect() {},
    }),
  );
  assert.match(bounded, /Bounded graph/u);
});

test("graph clusters neighbour records by primary domain around a hub", () => {
  const other: MemoryRecord = {
    ...record,
    id: "utterance:other",
    sourceId: "other",
    kind: "utterance",
    domains: ["cognition"],
    label: "neighbour",
  };
  const layout = layoutGraph(
    [record, other],
    [{ from: record.id, to: other.id, relation: "about" }],
    record.id,
  );
  assert.equal(layout.hubId, record.id);
  assert.equal(layout.points.length, 2);
  assert.equal(layout.clusters.length, 1);
  assert.equal(layout.clusters[0]?.name, "cognition");
  const html = renderToStaticMarkup(
    createElement(MemoryGraph, {
      graph: {
        nodes: [record, other],
        edges: [{ from: record.id, to: other.id, relation: "about" }],
        totalNodes: 2,
        totalEdges: 1,
      },
      selected: record.id,
      onSelect() {},
    }),
  );
  assert.match(html, /cognition/u);
  assert.match(html, /1 nodes/u);
  assert.match(html, /class="memory-edge selected"/u);
  assert.match(html, /<path d="M /u);
});

test("dense single-domain and many-domain maps preserve spacing, bounds and order independence", () => {
  for (const domains of [1, 6, 79]) {
    const nodes = Array.from({ length: 80 }, (_, i) => ({
      ...record,
      id: `node:${String(i).padStart(2, "0")}`,
      label: `Long synthetic memory label number ${i}`,
      domains: [`domain ${i % domains}`],
    }));
    const edges = nodes.slice(1).map((node) => ({
      from: nodes[0]!.id,
      to: node.id,
      relation: "references",
    }));
    const layout = layoutGraph(nodes, edges);
    assert.deepEqual(
      layout,
      layoutGraph([...nodes].reverse(), [...edges].reverse()),
    );
    assert.equal(layout.points.length, 80);
    for (const [i, a] of layout.points.entries()) {
      assert.ok(
        a.x >= 24 &&
          a.x <= layout.width - 24 &&
          a.y >= 24 &&
          a.y <= layout.height - 24,
      );
      for (const b of layout.points.slice(i + 1))
        assert.ok(
          Math.hypot(a.x - b.x, a.y - b.y) >= 33,
          `${domains}: ${a.id}/${b.id}`,
        );
    }
    const labels = layoutLabels(
      layout,
      nodes,
      nodes.map((node) => node.id),
    );
    for (const [i, a] of labels.entries())
      for (const b of labels.slice(i + 1)) {
        assert.ok(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + 30 <= b.y ||
            b.y + 30 <= a.y,
        );
      }
    const render = (selected: string | undefined) =>
      renderToStaticMarkup(
        createElement(MemoryGraph, {
          graph: {
            nodes,
            edges,
            totalNodes: nodes.length,
            totalEdges: edges.length,
          },
          selected,
          onSelect() {},
        }),
      );
    const positions = (html: string) =>
      [...html.matchAll(/transform="translate\([^"]+"/gu)].map((m) => m[0]);
    assert.deepEqual(
      positions(render(undefined)),
      positions(render(nodes[40]!.id)),
    );
  }
});

test("focused topology retains subdued graph context while exposing directed relation labels and parallel-link weight", () => {
  const selected: MemoryRecord = { ...record, id: "entity:selected", kind: "entity", label: "Selected" };
  const neighbour: MemoryRecord = { ...record, id: "claim:neighbour", label: "Neighbour" };
  const context: MemoryRecord = { ...record, id: "artifact:context", kind: "artifact", label: "Context" };
  const edges = [
    { from: selected.id, to: neighbour.id, relation: "supports" },
    { from: selected.id, to: neighbour.id, relation: "references" },
    { from: context.id, to: neighbour.id, relation: "appears_in" },
  ];
  const html = renderToStaticMarkup(
    createElement(MemoryGraph, {
      graph: { nodes: [selected, neighbour, context], edges, totalNodes: 3, totalEdges: 3 },
      selected: selected.id,
      onSelect() {},
    }),
  );
  assert.equal((html.match(/data-record-id=/gu) ?? []).length, 3);
  assert.equal((html.match(/marker-end=/gu) ?? []).length, 3);
  assert.match(html, /memory-edge selected parallel/u);
  assert.match(html, /memory-edge-label/u);
  assert.match(html, /supports/u);
  assert.equal(
    isFocusSubdued(true, selected.id, new Set([selected.id, neighbour.id]), context.id),
    true,
  );
  assert.equal(
    isFocusSubdued(true, selected.id, new Set([selected.id, neighbour.id]), neighbour.id),
    false,
  );
  assert.match(html, /thicker arrows mean parallel displayed stored links, not evidence strength/u);
  assert.equal(parallelEdgeCounts(edges).get(`${selected.id}\u0000${neighbour.id}`), 2);
});

test("inspector navigation preserves stored direction, parallel labels and self links", () => {
  const other = { ...record, id: "other", label: "Other <script> record" };
  const graph = {
    nodes: [record, other],
    totalNodes: 2,
    totalEdges: 4,
    edges: [
      { from: record.id, to: other.id, relation: "supports" },
      { from: other.id, to: record.id, relation: "derived_from" },
      { from: record.id, to: other.id, relation: "references" },
      { from: record.id, to: record.id, relation: "self_reference" },
    ],
  };
  const connections = storedConnections(record.id, graph);
  assert.deepEqual(
    connections.map((c) => c.direction),
    ["outgoing", "incoming", "outgoing", "self"],
  );
  assert.deepEqual(
    connections.map((c) => c.relation),
    graph.edges.map((e) => e.relation),
  );
  const html = renderToStaticMarkup(
    createElement(MemoryInspector, {
      record,
      connections,
      relatedCount: 4,
      onSelect() {},
      onClose() {},
    }),
  );
  assert.match(html, /4 stored links in this view/u);
  assert.match(html, /Other &lt;script&gt; record/u);
  assert.equal(html.includes("<script>"), false);
  const point = { id: "self", x: 100, y: 100 };
  assert.match(edgePath(point, point), / C /u);
  assert.equal(edgePath(point, point).includes("NaN"), false);
});
