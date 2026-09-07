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

export interface GraphCluster {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly count: number;
}

export interface GraphLayout {
  readonly points: GraphPoint[];
  readonly clusters: GraphCluster[];
  readonly hubId: string | undefined;
}

const WIDTH = 1200;
const HEIGHT = 780;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;

export function primaryDomain(node: MemoryRecord): string {
  return node.domains[0] ?? "Unlabelled";
}

function degreeMap(
  nodes: readonly MemoryRecord[],
  edges: readonly MemoryEdge[],
): Map<string, number> {
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  return degree;
}

/**
 * Domain-clustered radial layout around a hub record. Position is for
 * readability; distances make no semantic claim.
 */
export function layoutGraph(
  nodes: readonly MemoryRecord[],
  edges: readonly MemoryEdge[],
  hubId?: string,
): GraphLayout {
  if (nodes.length === 0) {
    return { points: [], clusters: [], hubId: undefined };
  }
  const degree = degreeMap(nodes, edges);
  const hub =
    nodes.find((node) => node.id === hubId) ??
    nodes.reduce((best, node) =>
      (degree.get(node.id) ?? 0) > (degree.get(best.id) ?? 0) ? node : best,
    );
  const points: GraphPoint[] = [{ id: hub.id, x: CX, y: CY }];
  const others = nodes.filter((node) => node.id !== hub.id);
  if (others.length === 0) {
    return { points, clusters: [], hubId: hub.id };
  }
  const grouped = new Map<string, MemoryRecord[]>();
  for (const node of others) {
    const name = primaryDomain(node);
    const list = grouped.get(name);
    if (list) list.push(node);
    else grouped.set(name, [node]);
  }
  const names = [...grouped.keys()].sort((a, b) => {
    const size = (grouped.get(b)?.length ?? 0) - (grouped.get(a)?.length ?? 0);
    return size !== 0 ? size : a.localeCompare(b);
  });
  const clusters: GraphCluster[] = [];
  const ring = Math.min(280, 120 + names.length * 18);
  names.forEach((name, index) => {
    const members = grouped.get(name) ?? [];
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / names.length;
    const clusterX = CX + Math.cos(angle) * ring;
    const clusterY = CY + Math.sin(angle) * ring;
    clusters.push({
      name,
      x: clusterX,
      y: clusterY - 58,
      count: members.length,
    });
    members.forEach((node, memberIndex) => {
      const count = members.length;
      const fan = Math.min(1.6, 0.22 * count);
      const offset = memberIndex - (count - 1) / 2;
      const local = angle + (count === 1 ? 0 : (offset * fan) / count);
      const radius = ring + 28 + (memberIndex % 4) * 18;
      points.push({
        id: node.id,
        x: CX + Math.cos(local) * radius + Math.cos(local + Math.PI / 2) * offset * 16,
        y: CY + Math.sin(local) * radius + Math.sin(local + Math.PI / 2) * offset * 16,
      });
    });
  });
  for (const point of points) {
    point.x = Math.max(70, Math.min(WIDTH - 70, point.x));
    point.y = Math.max(48, Math.min(HEIGHT - 40, point.y));
  }
  return { points, clusters, hubId: hub.id };
}

function shorten(label: string, limit: number): string {
  return label.length > limit ? `${label.slice(0, limit)}…` : label;
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
  const [focusMode, setFocusMode] = useState(false);
  const layout = useMemo(
    () => layoutGraph(graph.nodes, graph.edges, selected),
    [graph, selected],
  );
  const points = useMemo(
    () => new Map(layout.points.map((point) => [point.id, point])),
    [layout],
  );
  const connected = new Set(
    graph.edges
      .filter((edge) => edge.from === selected || edge.to === selected)
      .flatMap((edge) => [edge.from, edge.to]),
  );
  const hub = graph.nodes.find((node) => node.id === layout.hubId);
  return (
    <section
      className="memory-graph memory-card"
      aria-label="Memory relationship map graph"
    >
      <div className="memory-section-heading">
        <div>
          <h2>Explore how memories, concepts, and evidence are connected.</h2>
          <p className="memory-muted">
            {graph.nodes.length} / {graph.totalNodes} records ·{" "}
            {graph.edges.length} / {graph.totalEdges} links
          </p>
        </div>
        <div className="memory-graph-toolbar">
          <label className="memory-focus-toggle">
            <input
              type="checkbox"
              checked={focusMode}
              onChange={(event) => setFocusMode(event.target.checked)}
            />
            Focus mode
          </label>
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
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            style={{ width: `${zoom * 100}%`, minWidth: `${zoom * 640}px` }}
            aria-label="Stored record connections"
          >
            <defs>
              <radialGradient id="memory-hub-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#e8c547" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#e8c547" stopOpacity="0" />
              </radialGradient>
              <marker
                id="memory-arrow"
                viewBox="0 0 10 10"
                refX="18"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>
            {layout.clusters.map((cluster) => (
              <g key={cluster.name} className="memory-cluster">
                <text x={cluster.x} y={cluster.y}>
                  {cluster.name}
                </text>
                <text x={cluster.x} y={cluster.y + 14} className="memory-cluster-count">
                  {cluster.count} nodes
                </text>
              </g>
            ))}
            {hub ? (
              <circle
                className="memory-hub-glow"
                cx={CX}
                cy={CY}
                r="42"
                fill="url(#memory-hub-glow)"
              />
            ) : null}
            {graph.edges.map((edge) => {
              const a = points.get(edge.from);
              const b = points.get(edge.to);
              if (!a || !b) return null;
              const highlighted =
                edge.from === selected || edge.to === selected;
              const dimmed =
                focusMode &&
                selected !== undefined &&
                !highlighted;
              return (
                <g
                  key={JSON.stringify(edge)}
                  className={
                    highlighted ? "memory-edge selected" : "memory-edge"
                  }
                  opacity={dimmed ? 0.08 : 1}
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
                    <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6}>
                      {edge.relation}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {graph.nodes.map((node) => {
              const point = points.get(node.id);
              if (!point) return null;
              const isHub = node.id === layout.hubId;
              const isSelected = node.id === selected;
              const dimmed =
                (focusMode &&
                  selected !== undefined &&
                  node.id !== selected &&
                  !connected.has(node.id)) ||
                (selected !== undefined &&
                  !focusMode &&
                  node.id !== selected &&
                  !connected.has(node.id) &&
                  !isHub);
              return (
                <g
                  key={node.id}
                  className={`memory-node memory-kind-${node.kind}${isSelected ? " selected" : ""}${isHub ? " hub" : ""}${dimmed ? " dimmed" : ""}`}
                  transform={`translate(${point.x} ${point.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Inspect ${node.kind}: ${node.label}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelect(node)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(node);
                    }
                  }}
                >
                  <title>{node.label}</title>
                  <circle r={isHub || isSelected ? 14 : 7} />
                  <text x={isHub ? 0 : 16} y={isHub ? 32 : 4} textAnchor={isHub ? "middle" : "start"}>
                    {shorten(node.label, isHub ? 42 : 28)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
      <p className="memory-muted memory-graph-note">
        Each node is a memory record. Lines show stored references, derivations
        or shared context. Node position is semantic grouping by domain, not
        similarity distance.
        {graph.nodes.length > 0 && graph.edges.length === 0
          ? " No stored links connect the displayed records."
          : ""}
      </p>
    </section>
  );
}
