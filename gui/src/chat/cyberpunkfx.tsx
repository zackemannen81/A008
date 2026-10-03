import { useEffect, useRef } from "react";
import { startCyberpunkFx } from "./cyberpunk-fx-engine.js";

/** Cyberpunk plasma & metaballs background behind the empty conversation. */
export function CyberpunkFxBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (canvas === null || host === null) return undefined;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return startCyberpunkFx(canvas, host, { reducedMotion: reduced });
  }, []);

  return (
    <div className="a008-starfield" ref={hostRef} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}