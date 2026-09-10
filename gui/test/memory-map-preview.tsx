import { createRoot } from "react-dom/client";
import { MemoryPage } from "../src/memory/memory-page.js";
import {
  MEMORY_KINDS,
  type MemoryEdge,
  type MemoryRecord,
  type MemorySnapshot,
} from "../src/memory/memory-client.js";
import "../src/brand/themes.css";
import "../src/brand/a008.css";
import "../src/brand/workspace.css";

const scenario = new URLSearchParams(location.search).get("scenario");
const domains = [
  "AI & teknik",
  "Kognition",
  "Datavetenskap",
  "Systemdesign",
  "Användarintention",
  "Källor & evidens",
];
const labels = [
  "Artificiellt minne",
  "Lagring",
  "Åtkomst och integritet",
  "Minneshantering",
  "Metadata",
  "Representation",
  "Hämtning",
  "Embedding",
  "Planering",
  "Resonemang",
  "Dokumentation",
  "Källhänvisning",
];
const all: MemoryRecord[] = Array.from(
  { length: scenario === "empty" ? 0 : 80 },
  (_, i) => ({
    id: `fixture:${i}`,
    sourceId: `synthetic-record-${i}`,
    kind: MEMORY_KINDS[i % MEMORY_KINDS.length]!,
    label:
      i === 0
        ? "Artificiellt minne och dess komponenter"
        : `${labels[i % labels.length]} · ${i}`,
    status: "asserted",
    activation: i % 5 === 0 ? "dormant" : "active",
    tags: ["synthetic", "memory"],
    domains: [
      scenario === "single"
        ? "Ett stort område"
        : scenario === "many"
          ? `Område ${i}`
          : domains[i % 6]!,
    ],
    detail: JSON.stringify({
      content: `Synthetic example ${i}. These are visual test records, never user memory.`,
      confidence: 0.8,
    }),
    truncated: false,
  }),
);
const allEdges: MemoryEdge[] = all
  .slice(1)
  .map((node, i) => ({
    from: i < 6 ? all[0]!.id : all[1 + (i % 6)]!.id,
    to: node.id,
    relation: "references",
  }));
for (let i = 7; i < all.length; i++)
  allEdges.push({
    from: all[i]!.id,
    to: all[i - 6]!.id,
    relation: "derived_from",
  });
if (scenario === "dense")
  for (let i = 0; allEdges.length < 240; i++)
    allEdges.push({
      from: all[i % 80]!.id,
      to: all[(i + 17) % 80]!.id,
      relation: "supports",
    });
// The actual page/client parser runs against this in-browser fixture. Every
// fetch outside the memory read fails, so no host, credentials or database run.
window.fetch = async (input) => {
  const url = new URL(String(input), location.origin);
  if (url.pathname !== "/v1/memory")
    throw new Error("Unexpected preview request");
  const p = url.searchParams;
  const nodes = all.filter(
    (n) =>
      (!p.get("kind") || n.kind === p.get("kind")) &&
      (!p.get("domain") || n.domains.includes(p.get("domain")!)) &&
      (!p.get("status") ||
        n.status === p.get("status") ||
        n.activation === p.get("status")) &&
      (!p.get("query") ||
        n.label.toLowerCase().includes(p.get("query")!.toLowerCase())),
  );
  const ids = new Set(nodes.map((n) => n.id));
  const edges = allEdges.filter((e) => ids.has(e.from) && ids.has(e.to));
  const counts = Object.fromEntries(
    MEMORY_KINDS.map((kind) => [
      kind,
      all.filter((n) => n.kind === kind).length,
    ]),
  ) as MemorySnapshot["summary"]["counts"];
  const data: MemorySnapshot = {
    protocol: "A008_MEMORY_INSPECT_V1",
    projectId: "synthetic-preview",
    durable: false,
    summary: {
      total: all.length,
      counts,
      active: all.filter((n) => n.activation === "active").length,
      dormant: all.filter((n) => n.activation === "dormant").length,
      contestedSlots: 0,
      domains: [...new Set(all.flatMap((n) => n.domains))].map((name) => ({
        name,
        count: all.filter((n) => n.domains.includes(name)).length,
      })),
      statuses: ["asserted"],
    },
    records: nodes.slice(
      Number(p.get("offset") ?? 0),
      Number(p.get("offset") ?? 0) + 40,
    ),
    matched: nodes.length,
    offset: Number(p.get("offset") ?? 0),
    limit: 40,
    graph: { nodes, edges, totalNodes: nodes.length, totalEdges: edges.length },
  };
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};

createRoot(document.getElementById("root")!).render(
  <>
    <div
      style={{
        padding: "10px 24px",
        borderBottom: "1px solid #333",
        font: "12px sans-serif",
        color: "#bdb6a0",
      }}
    >
      A008 · Isolated visual check · Synthetic records only
    </div>
    <div
      style={{ height: "calc(100vh - 35px)", fontFamily: "var(--a008-sans)" }}
    >
      <MemoryPage active />
    </div>
  </>,
);
