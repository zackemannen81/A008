import type { MemoryEdge, MemoryRecord } from "./memory-client.js";

export type GraphProjection = "force" | "cluster" | "hierarchy";
export type GraphMode = "overview" | "inspect";

export interface GraphPoint {
  readonly id: string;
  x: number;
  y: number;
}
export interface GraphCluster {
  readonly name: string;
  x: number;
  y: number;
  readonly radius: number;
  readonly count: number;
  readonly leadId: string;
}
export interface GraphLayout {
  readonly points: GraphPoint[];
  readonly clusters: GraphCluster[];
  readonly hubId: string | undefined;
  readonly width: number;
  readonly height: number;
}

export function primaryDomain(node: MemoryRecord): string {
  return node.domains[0] ?? "Unlabelled";
}

export function degreeMap(
  nodes: readonly MemoryRecord[],
  edges: readonly MemoryEdge[],
) {
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  return degree;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const compareId = (a: MemoryRecord, b: MemoryRecord) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

function layoutHierarchy(nodes: readonly MemoryRecord[], edges: readonly MemoryEdge[]): GraphLayout {
  const incoming = new Map<string, number>();
  for (const edge of edges) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  const levels = new Map<string, number>();
  const visit = (id: string, seen = new Set<string>()): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const parents = edges.filter((edge) => edge.to === id).map((edge) => edge.from);
    const level = parents.length ? 1 + Math.max(...parents.map((parent) => visit(parent, new Set(seen)))) : 0;
    levels.set(id, level);
    return level;
  };
  nodes.forEach((node) => visit(node.id));
  const byLevel = new Map<number, MemoryRecord[]>();
  [...nodes].sort(compareId).forEach((node) => {
    const list = byLevel.get(levels.get(node.id) ?? 0) ?? [];
    list.push(node); byLevel.set(levels.get(node.id) ?? 0, list);
  });
  const points = [...byLevel].flatMap(([level, members]) => members.map((node, index) => ({
    id: node.id, x: 120 + index * 150, y: 100 + level * 130,
  })));
  const width = Math.max(1000, ...points.map((point) => point.x + 120), 1000);
  const height = Math.max(680, ...points.map((point) => point.y + 100), 680);
  return { points, clusters: [], hubId: [...nodes].sort((a, b) => (incoming.get(b.id) ?? 0) - (incoming.get(a.id) ?? 0) || compareId(a, b))[0]?.id, width, height };
}

function layoutForce(nodes: readonly MemoryRecord[], edges: readonly MemoryEdge[]): GraphLayout {
  const ordered = [...nodes].sort(compareId);
  const points = ordered.map((node, index) => {
    const angle = index * GOLDEN_ANGLE;
    const radius = 70 * Math.sqrt(index);
    return { id: node.id, x: 500 + Math.cos(angle) * radius, y: 340 + Math.sin(angle) * radius };
  });
  // A deterministic radial approximation keeps the projection pure and stable; it never adds edges.
  return { points, clusters: [], hubId: [...nodes].sort((a, b) => degreeMap(nodes, edges).get(b.id)! - degreeMap(nodes, edges).get(a.id)! || compareId(a, b))[0]?.id, width: 1000, height: 680 };
}

/** Deterministic circle packing around a hub, without simulation or clamping. */
function layoutClustered(nodes: readonly MemoryRecord[], edges: readonly MemoryEdge[], hubId?: string): GraphLayout {
  if (!nodes.length) return { points: [], clusters: [], hubId: undefined, width: 1000, height: 680 };
  const degree = degreeMap(nodes, edges);
  const ranked = [...nodes].sort((a, b) => degree.get(b.id)! - degree.get(a.id)! || compareId(a, b));
  const hub = nodes.find((node) => node.id === hubId) ?? ranked[0]!;
  const points: GraphPoint[] = [{ id: hub.id, x: 0, y: 0 }];
  const grouped = new Map<string, MemoryRecord[]>();
  for (const node of ranked) { if (node.id !== hub.id) { const list = grouped.get(primaryDomain(node)) ?? []; list.push(node); grouped.set(primaryDomain(node), list); } }
  const groups = [...grouped].sort(([a, aa], [b, bb]) => bb.length - aa.length || (a < b ? -1 : a > b ? 1 : 0));
  const clusters: GraphCluster[] = [], occupied = [{ x: 0, y: 0, radius: 100 }];
  for (const [name, members] of groups) {
    const radius = Math.max(88, 34 * Math.sqrt(members.length) + 48); let x = 0, y = 0, step = 0;
    do { const distance = 22 * Math.sqrt(++step), angle = step * GOLDEN_ANGLE; x = Math.cos(angle) * distance * 1.45; y = Math.sin(angle) * distance * 0.75; } while (occupied.some((other) => Math.hypot(x - other.x, y - other.y) < radius + other.radius + 24));
    occupied.push({ x, y, radius }); clusters.push({ name, x, y, radius, count: members.length, leadId: members[0]!.id });
    members.forEach((node, i) => { const distance = i === 0 ? 0 : 34 * Math.sqrt(i); points.push({ id: node.id, x: x + Math.cos(i * GOLDEN_ANGLE) * distance, y: y + Math.sin(i * GOLDEN_ANGLE) * distance }); });
  }
  const left = Math.min(...occupied.map((c) => c.x - c.radius)) - 35, top = Math.min(...occupied.map((c) => c.y - c.radius)) - 35, right = Math.max(...occupied.map((c) => c.x + c.radius)) + 35, bottom = Math.max(...occupied.map((c) => c.y + c.radius)) + 35;
  const width = Math.max(1000, right - left), height = Math.max(680, bottom - top), dx = -left + (width - (right - left)) / 2, dy = -top + (height - (bottom - top)) / 2;
  points.forEach((point) => { point.x += dx; point.y += dy; }); clusters.forEach((cluster) => { cluster.x += dx; cluster.y += dy; });
  return { points, clusters, hubId: hub.id, width, height };
}

export function layoutGraph(nodes: readonly MemoryRecord[], edges: readonly MemoryEdge[], projectionOrHub: GraphProjection | string = "cluster", legacyHubId?: string): GraphLayout {
  const projection: GraphProjection = projectionOrHub === "force" || projectionOrHub === "hierarchy" || projectionOrHub === "cluster" ? projectionOrHub : "cluster";
  const hubId = projectionOrHub === "cluster" ? legacyHubId : projectionOrHub === "force" || projectionOrHub === "hierarchy" ? legacyHubId : projectionOrHub;
  if (projection === "force") return layoutForce(nodes, edges);
  if (projection === "hierarchy") return layoutHierarchy(nodes, edges);
  return layoutClustered(nodes, edges, hubId);
}

export function getEdgeStyle(edge: MemoryEdge, highlighted: boolean) {
  const activation = (edge as MemoryEdge & { activation?: string }).activation;
  const dormant = activation === "dormant";
  const relation = edge.relation.toLowerCase();
  const provenance = relation.includes("derived") || relation.includes("evidence") || relation.includes("provenance");
  return { strokeWidth: highlighted ? 2.5 : 1, strokeDasharray: dormant ? "5 5" : provenance ? "2 2" : undefined, opacity: highlighted ? 1 : 0.25 };
}

export interface GraphLabel { readonly id: string; readonly text: string; readonly x: number; readonly y: number; readonly width: number; }
interface Box { x: number; y: number; width: number; height: number; }
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
export const shorten = (text: string, limit: number) => text.length > limit ? `${text.slice(0, limit)}…` : text;
export function layoutLabels(layout: GraphLayout, nodes: readonly MemoryRecord[], priority: readonly string[]) {
  const records = new Map(nodes.map((node) => [node.id, node])), points = new Map(layout.points.map((point) => [point.id, point])), boxes: Box[] = layout.points.map((p) => ({ x: p.x - 16, y: p.y - 16, width: 32, height: 32 }));
  for (const c of layout.clusters) boxes.push({ x: c.x - 110, y: c.y - c.radius + 3, width: 220, height: 44 });
  const labels: GraphLabel[] = [];
  for (const id of new Set(priority)) { const point = points.get(id), record = records.get(id); if (!point || !record) continue; const text = shorten(record.label || record.sourceId, 22), width = Math.max(44, [...text].length * 11 + 16); const candidates = [{ x: point.x + 20, y: point.y - 15, width, height: 30 }, { x: point.x - width - 20, y: point.y - 15, width, height: 30 }, { x: point.x - width / 2, y: point.y + 20, width, height: 30 }, { x: point.x - width / 2, y: point.y - 50, width, height: 30 }]; const box = candidates.find((b) => b.x >= 8 && b.y >= 8 && b.x + b.width <= layout.width - 8 && b.y + b.height <= layout.height - 8 && !boxes.some((other) => overlaps(b, other))); if (!box) continue; boxes.push(box); labels.push({ id, text, x: box.x, y: box.y, width }); }
  return labels;
}

export function edgePath(a: GraphPoint, b: GraphPoint): string {
  if (a.id === b.id) return `M ${a.x - 5} ${a.y - 10} C ${a.x - 60} ${a.y - 72}, ${a.x + 60} ${a.y - 72}, ${a.x + 5} ${a.y - 10}`;
  const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy), bend = Math.min(48, distance * 0.15);
  return `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2 - (dy / distance) * bend} ${(a.y + b.y) / 2 + (dx / distance) * bend} ${b.x} ${b.y}`;
}
