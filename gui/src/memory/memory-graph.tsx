import { useMemo, useState } from "react";
import {
  KIND_LABEL,
  MEMORY_KINDS,
  type MemoryEdge,
  type MemoryRecord,
  type MemorySnapshot,
} from "./memory-client.js";

export interface GraphPoint {
  readonly id: string;
  x: number;
  y: number;
}
/** Stable bounded layout; distances and clusters make no semantic claim. */
export function layoutGraph(
  nodes: readonly MemoryRecord[],
  edges: readonly MemoryEdge[],
): GraphPoint[] {
  const points = nodes.map((node, i) => ({
    id: node.id,
    x: 500 + 260 * Math.cos(i * 2.39996),
    y: 320 + 230 * Math.sin(i * 2.39996),
  }));
  const byId = new Map(points.map((point) => [point.id, point]));
  for (let step = 0; step < 100; step += 1) {
    for (let i = 0; i < points.length; i += 1)
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i]!;
        const b = points[j]!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const force = Math.min(7, 1000 / (d * d));
        a.x += (dx / d) * force;
        a.y += (dy / d) * force;
        b.x -= (dx / d) * force;
        b.y -= (dy / d) * force;
      }
    for (const edge of edges) {
      const a = byId.get(edge.from);
      const b = byId.get(edge.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const force = (d - 100) * 0.025;
      a.x += (dx / d) * force;
      a.y += (dy / d) * force;
      b.x -= (dx / d) * force;
      b.y -= (dy / d) * force;
    }
    for (const point of points) {
      point.x = Math.max(65, Math.min(910, point.x));
      point.y = Math.max(45, Math.min(590, point.y));
    }
  }
  if (points.length > 1) {
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));
    for (const point of points) {
      point.x = 45 + ((point.x - minX) / Math.max(1, maxX - minX)) * 800;
      point.y = 40 + ((point.y - minY) / Math.max(1, maxY - minY)) * 540;
    }
  }
  return points;
}

export function MemoryGraph({
  graph,
  selected,
  onSelect,
}: {
  graph: MemorySnapshot["graph"];
  selected: string | undefined;
  onSelect: (record: MemoryRecord) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const points = useMemo(
    () =>
      new Map(
        layoutGraph(graph.nodes, graph.edges).map((point) => [point.id, point]),
      ),
    [graph],
  );
  const connected = new Set(
    graph.edges
      .filter((edge) => edge.from === selected || edge.to === selected)
      .flatMap((edge) => [edge.from, edge.to]),
  );
  return (
    <section
      className="memory-graph memory-card"
      aria-label="Memory relationship map graph"
    >
      <div className="memory-section-heading">
        <div>
          <h2>Stored relationships</h2>
          <p className="memory-muted">
            {graph.nodes.length} / {graph.totalNodes} records ·{" "}
            {graph.edges.length} / {graph.totalEdges} links
          </p>
        </div>
        <div className="memory-zoom">
          <button
            onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
            disabled={zoom <= 0.75}
            aria-label="Zoom out"
          >
            −
          </button>
          <button onClick={() => setZoom(1)} aria-label="Reset graph zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
            disabled={zoom >= 2.5}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>
      <div className="memory-graph-legend">
        {MEMORY_KINDS.filter((kind) =>
          graph.nodes.some((node) => node.kind === kind),
        ).map((kind) => (
          <span key={kind}>
            <i className={`memory-kind-dot memory-kind-${kind}`} />
            {KIND_LABEL[kind]}
          </span>
        ))}
      </div>
      {graph.nodes.length < graph.totalNodes ||
      graph.edges.length < graph.totalEdges ? (
        <p className="memory-warning">
          Bounded graph: up to 80 records and 240 stored links. Search or filter
          to narrow the view.
        </p>
      ) : null}
      {graph.nodes.length === 0 ? (
        <p className="memory-empty-small">No records match these filters.</p>
      ) : (
        <div
          className="memory-graph-scroll"
          tabIndex={0}
          aria-label="Scrollable relationship graph"
        >
          <svg
            viewBox="0 0 1000 640"
            style={{ width: `${zoom * 100}%`, minWidth: `${zoom * 560}px` }}
            aria-label="Stored record connections"
          >
            <defs>
              <marker
                id="memory-arrow"
                viewBox="0 0 10 10"
                refX="20"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>
            {graph.edges.map((edge) => {
              const a = points.get(edge.from)!;
              const b = points.get(edge.to)!;
              const highlighted =
                edge.from === selected || edge.to === selected;
              return (
                <g
                  key={JSON.stringify(edge)}
                  className={
                    highlighted ? "memory-edge selected" : "memory-edge"
                  }
                >
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    markerEnd="url(#memory-arrow)"
                  />
                  <title>{edge.relation}</title>
                  {highlighted ? (
                    <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 5}>
                      {edge.relation}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {graph.nodes.map((node) => {
              const point = points.get(node.id)!;
              return (
                <g
                  key={node.id}
                  className={`memory-node memory-kind-${node.kind}${node.id === selected ? " selected" : ""}${selected && !connected.has(node.id) && selected !== node.id ? " dimmed" : ""}`}
                  transform={`translate(${point.x} ${point.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Inspect ${node.kind}: ${node.label}`}
                  aria-pressed={selected === node.id}
                  onClick={() => onSelect(node)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(node);
                    }
                  }}
                >
                  <title>{node.label}</title>
                  <circle r={node.id === selected ? 12 : 8} />
                  <text x={14} y={4}>
                    {node.label.length > 23
                      ? `${node.label.slice(0, 23)}…`
                      : node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
      <p className="memory-muted memory-graph-note">
        Arrows show stored references and provenance. Position is for
        readability; distance does not indicate similarity.
        {graph.nodes.length > 0 && graph.edges.length === 0
          ? " No stored links connect the displayed records."
          : ""}
      </p>
    </section>
  );
}
