import { useId, useMemo, useRef, useState } from "react";
import { NodeShape } from "./memory-graph-shape.jsx";
import {
  KIND_LABEL,
  MEMORY_KINDS,
  type MemoryRecord,
  type MemorySnapshot,
} from "./memory-client.js";
import {
  degreeMap,
  edgePath,
  layoutGraph,
  layoutLabels,
  shorten,
} from "./memory-graph-layout.js";
export { layoutGraph, primaryDomain } from "./memory-graph-layout.js";

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
  const [hovered, setHovered] = useState<string>();
  const viewport = useRef<HTMLDivElement>(null);
  const id = useId();
  // Selection changes emphasis, never the map's spatial reference.
  const layout = useMemo(
    () => layoutGraph(graph.nodes, graph.edges),
    [graph.nodes, graph.edges],
  );
  const points = useMemo(
    () => new Map(layout.points.map((point) => [point.id, point])),
    [layout],
  );
  const degree = useMemo(
    () => degreeMap(graph.nodes, graph.edges),
    [graph.nodes, graph.edges],
  );
  const connected = new Set(
    graph.edges
      .filter((edge) => edge.from === selected || edge.to === selected)
      .flatMap((edge) => [edge.from, edge.to]),
  );
  const focused = focusMode && selected !== undefined;
  const visible = (nodeId: string) =>
    !focused || nodeId === selected || connected.has(nodeId);
  const priority = [
    selected,
    hovered,
    ...(selected ? [...connected] : []),
    layout.hubId,
    ...layout.clusters.slice(0, 10).map((cluster) => cluster.leadId),
  ].filter((value): value is string => value !== undefined && visible(value));
  const labels = layoutLabels(layout, graph.nodes, priority);
  const visiblePoints = layout.points.filter((point) => visible(point.id));
  // Focus changes the camera, not record positions. Include labels in the frame
  // so a small neighbourhood remains readable even on a narrow screen.
  const left = Math.min(
    ...visiblePoints.map((p) => p.x - 40),
    ...labels.map((l) => l.x - 12),
  );
  const top = Math.min(
    ...visiblePoints.map((p) => p.y - 40),
    ...labels.map((l) => l.y - 12),
  );
  const right = Math.max(
    ...visiblePoints.map((p) => p.x + 40),
    ...labels.map((l) => l.x + l.width + 12),
  );
  const bottom = Math.max(
    ...visiblePoints.map((p) => p.y + 40),
    ...labels.map((l) => l.y + 42),
  );
  const frame =
    focused && visiblePoints.length
      ? `${left - 25} ${top - 25} ${right - left + 50} ${bottom - top + 50}`
      : `0 0 ${layout.width} ${layout.height}`;
  const hub = layout.hubId ? points.get(layout.hubId) : undefined;
  const active = graph.nodes.find((node) => node.id === (hovered ?? selected));
  function fit() {
    setZoom(1);
    viewport.current?.scrollTo({ left: 0, top: 0 });
  }
  return (
    <section
      className="memory-graph memory-card"
      aria-label="Memory relationship map graph"
    >
      <div className="memory-section-heading memory-map-heading">
        <div>
          <h2>Stored connections</h2>
          <p className="memory-muted">
            {graph.nodes.length} / {graph.totalNodes} records ·{" "}
            {graph.edges.length} / {graph.totalEdges} links
          </p>
        </div>
        <div className="memory-graph-toolbar">
          <label
            className="memory-focus-toggle"
            title={
              selected
                ? "Show the selected record and its stored neighbours"
                : "Select a record to focus its connections"
            }
          >
            <input
              type="checkbox"
              checked={focused}
              disabled={!selected}
              onChange={(event) => {
                setFocusMode(event.target.checked);
                fit();
              }}
            />
            Focus mode
          </label>
          <div className="memory-zoom">
            <button
              onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
              disabled={zoom <= 1}
              aria-label="Zoom out"
            >
              −
            </button>
            <button onClick={fit} aria-label="Fit graph to view">
              {zoom === 1 ? "Fit" : `${Math.round(zoom * 100)}%`}
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(5, z + 0.5))}
              disabled={zoom >= 5}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div className="memory-graph-legend" aria-label="Record kinds">
        {MEMORY_KINDS.filter((kind) =>
          graph.nodes.some((node) => node.kind === kind),
        ).map((kind) => (
          <span key={kind}>
            <i className={`memory-kind-dot memory-kind-${kind}`} />
            {KIND_LABEL[kind]}
          </span>
        ))}
        <span className="memory-legend-hint">
          Dashed ring · dormant evidence
        </span>
      </div>
      {graph.nodes.length < graph.totalNodes ||
      graph.edges.length < graph.totalEdges ? (
        <p className="memory-warning">
          Bounded graph: up to 80 records and 240 stored links. Search or filter
          to narrow the view.
        </p>
      ) : null}
      {!graph.nodes.length ? (
        <p className="memory-empty-small">No records match these filters.</p>
      ) : (
        <div
          ref={viewport}
          className="memory-graph-scroll"
          tabIndex={0}
          aria-label="Scrollable relationship graph"
        >
          <svg
            viewBox={frame}
            style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
            aria-label="Stored record connections"
          >
            <defs>
              <radialGradient id={`${id}-glow`}>
                <stop offset="0%" stopColor="var(--a008-viz-identity)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--a008-viz-identity)" stopOpacity="0" />
              </radialGradient>
              <marker
                id={`${id}-arrow`}
                viewBox="0 0 10 10"
                refX="20"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>
            {!focused
              ? layout.clusters.map((cluster) => (
                  <g
                    key={cluster.name}
                    className="memory-cluster"
                    aria-hidden="true"
                  >
                    <circle cx={cluster.x} cy={cluster.y} r={cluster.radius} />
                    <text x={cluster.x} y={cluster.y - cluster.radius + 23}>
                      {shorten(cluster.name, 18)}
                    </text>
                    <text
                      x={cluster.x}
                      y={cluster.y - cluster.radius + 43}
                      className="memory-cluster-count"
                    >
                      {cluster.count} nodes
                    </text>
                  </g>
                ))
              : null}
            {hub && visible(hub.id) ? (
              <circle
                cx={hub.x}
                cy={hub.y}
                r="62"
                fill={`url(#${id}-glow)`}
                aria-hidden="true"
              />
            ) : null}
            {graph.edges.map((edge) => {
              const a = points.get(edge.from),
                b = points.get(edge.to);
              const highlighted =
                edge.from === selected || edge.to === selected;
              if (!a || !b || (focused && !highlighted)) return null;
              return (
                <g
                  key={JSON.stringify(edge)}
                  className={`memory-edge${highlighted ? " selected" : ""}${selected && !highlighted ? " subdued" : ""}`}
                >
                  <path
                    d={edgePath(a, b)}
                    markerEnd={highlighted ? `url(#${id}-arrow)` : undefined}
                  />
                  <title>{edge.relation}</title>
                </g>
              );
            })}
            {graph.nodes
              .filter((node) => visible(node.id))
              .map((node) => {
                const point = points.get(node.id)!;
                const isHub = node.id === layout.hubId,
                  isSelected = node.id === selected;
                const dimmed =
                  selected !== undefined &&
                  !isSelected &&
                  !connected.has(node.id);
                return (
                  <g
                    key={node.id}
                    data-record-id={node.id}
                    className={`memory-node memory-kind-${node.kind}${isHub ? " hub" : ""}${isSelected ? " selected" : ""}${dimmed ? " dimmed" : ""}${node.activation === "dormant" ? " dormant" : ""}`}
                    transform={`translate(${point.x} ${point.y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect ${node.kind}: ${node.label}`}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(node)}
                    onMouseEnter={() => setHovered(node.id)}
                    onMouseLeave={() => setHovered(undefined)}
                    onFocus={() => setHovered(node.id)}
                    onBlur={() => setHovered(undefined)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(node);
                      }
                    }}
                  >
                    <title>{node.label}</title>
                    <NodeShape kind={node.kind} size={isHub ? 23 : 16} />
                    <circle className="memory-node-hit" r="20" />
                    <circle className="memory-node-ring" r={isHub ? 23 : 16} />
                    <circle
                      className="memory-node-dot"
                      r={
                        isHub
                          ? 16
                          : Math.min(
                              11,
                              7 + Math.sqrt(degree.get(node.id) ?? 0),
                            )
                      }
                    />
                  </g>
                );
              })}
            <g className="memory-node-labels" aria-hidden="true">
              {labels.map((label) => (
                <g
                  key={label.id}
                  className={label.id === selected ? "selected" : ""}
                >
                  <rect
                    x={label.x}
                    y={label.y}
                    width={label.width}
                    height="30"
                    rx="5"
                  />
                  <text x={label.x + 8} y={label.y + 21}>
                    {label.text}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>
      )}
      <div className="memory-map-caption" aria-live="polite">
        {active ? (
          <>
            <span className={`memory-kind-dot memory-kind-${active.kind}`} />
            <span>{active.label || active.sourceId}</span>
          </>
        ) : (
          <span>
            Select a node to read its full record and follow stored connections.
            Zoom to separate dense areas.
          </span>
        )}
      </div>
      <p className="memory-muted memory-graph-note">
        Grouped by primary domain; distance does not measure similarity. Node
        size reflects displayed link count. Lines represent stored links only.
        Viewing does not reinforce memory.
        {graph.nodes.length > 0 && !graph.edges.length
          ? " No stored links connect the displayed records."
          : ""}
      </p>
    </section>
  );
}
