export function NodeShape({ kind, size }: { kind: string; size: number }) {
  switch (kind) {
    case "entity": // Cirkel
      return <circle r={size} className="memory-node-shape shape-entity" />;
    case "slot": // Pill / Hex
      return <rect className="memory-node-shape" x={-size} y={-size * 0.6} width={size * 2} height={size * 1.2} rx={size * 0.6} />;
    case "claim": // Fyrkant
      return <rect className="memory-node-shape" x={-size} y={-size} width={size * 2} height={size * 2} rx={3} />;
    case "utterance": // Capsule
      return <rect className="memory-node-shape" x={-size * 1.3} y={-size * 0.5} width={size * 2.6} height={size * 1.0} rx={8} />;
    case "artifact": // Diamant
      return <polygon className="memory-node-shape" points={`0,${-size} ${size},0 0,${size} ${-size},0`} />;
    case "provenance": // Dotted ring
      return <circle className="memory-node-shape" r={size * 0.9} strokeDasharray="3 3" fill="none" />;
    default:
      return <circle className="memory-node-shape" r={size} />;
  }
}