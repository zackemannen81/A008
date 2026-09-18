import type { MemoryKind } from "./memory-client.js";

export function NodeShape({ kind, size }: { kind: MemoryKind | string; size: number }) {
  switch (kind) {
    case "entity":
      return <circle r={size} className="shape-entity" />;
    case "state":
      return <rect x={-size} y={-size} width={size * 2} height={size * 2} rx={size * 0.25} />;
    case "claim":
      return <rect x={-size} y={-size} width={size * 2} height={size * 2} rx={3} />;
    case "utterance":
      return <rect x={-size * 1.3} y={-size * 0.5} width={size * 2.6} height={size} rx={size * 0.5} />;
    case "artifact":
      return <polygon points={`0,${-size} ${size},0 0,${size} ${-size},0`} />;
    case "provenance":
      return <circle r={size * 0.9} strokeDasharray="3 3" fill="none" />;
    case "history":
      return <path d={`M ${-size} 0 L 0 ${-size} L ${size} 0 L 0 ${size} Z`} />;
    case "event":
      return <path d={`M 0 ${-size} L ${size} ${size} L ${-size} ${size} Z`} />;
    default:
      return <circle r={size} />;
  }
}