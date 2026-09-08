import { useEffect, useRef } from "react";
import { startStarfield } from "./starfield-engine.js";

/** Transparent 4D starfield behind the empty conversation. */
export function EmptyStarfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (canvas === null || host === null) return undefined;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return startStarfield(canvas, host, { reducedMotion: reduced });
  }, []);

  return (
    <div className="a008-starfield" ref={hostRef} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
