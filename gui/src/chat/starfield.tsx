import { useEffect, useState, useRef } from "react";
import { startStarfield } from "./starfield-engine.js";
import { startCyberpunkFx } from "./cyberpunk-fx-engine.js";

export function EmptyStarfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<string>("neutral");

  // Läs av aktivt tema vid start och lyssna på ändringar i DOM
  useEffect(() => {
    const root = document.documentElement;
    const currentTheme = root.getAttribute("data-a008-theme") ?? "neutral";
    setTheme(currentTheme);

    const observer = new MutationObserver(() => {
      const updatedTheme = root.getAttribute("data-a008-theme") ?? "neutral";
      setTheme(updatedTheme);
    });

    observer.observe(root, { attributes: true, attributeFilter: ["data-a008-theme"] });
    return () => observer.disconnect();
  }, []);

  // Starta rätt motor beroende på tema
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (canvas === null || host === null) return undefined;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (theme === "cyberpunk") {
      return startCyberpunkFx(canvas, host, { reducedMotion: reduced });
    } else {
      return startStarfield(canvas, host, { reducedMotion: reduced });
    }
  }, [theme]);

  return (
    <div className="a008-starfield" ref={hostRef} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}