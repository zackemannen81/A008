/** 4D starfield for the empty chat pane. Trails fade without an opaque fill. */

export type Vec4 = [number, number, number, number];

export interface Star {
  readonly p: Vec4;
  readonly hue: number;
}

export const STARFIELD_COUNT = 720;
const EXTENT = 900;
const DIST4 = 700;
const DIST3 = 600;

export function rotate4(
  point: Vec4,
  i: 0 | 1 | 2 | 3,
  j: 0 | 1 | 2 | 3,
  angle: number,
): void {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const a = point[i];
  const b = point[j];
  point[i] = a * cosine - b * sine;
  point[j] = a * sine + b * cosine;
}

export function createStars(
  count = STARFIELD_COUNT,
  random: () => number = Math.random,
): Star[] {
  const stars: Star[] = [];
  for (let n = 0; n < count; n += 1) {
    stars.push({
      p: [
        (random() * 2 - 1) * EXTENT,
        (random() * 2 - 1) * EXTENT,
        (random() * 2 - 1) * EXTENT,
        (random() * 2 - 1) * EXTENT,
      ],
      hue: 200 + random() * 80,
    });
  }
  return stars;
}

export function startStarfield(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  options: { readonly reducedMotion?: boolean } = {},
): () => void {
  const context = canvas.getContext("2d");
  if (context === null || options.reducedMotion) {
    return () => undefined;
  }
  const ctx = context;

  const stars = createStars();
  let width = 0;
  let height = 0;
  let cx = 0;
  let cy = 0;
  let mouseX = 0;
  let mouseY = 0;
  let frame = 0;

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${String(width)}px`;
    canvas.style.height = `${String(height)}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = width / 2;
    cy = height / 2;
  }

  function onMove(event: MouseEvent): void {
    const box = host.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    mouseX = (event.clientX - box.left) / box.width - 0.5;
    mouseY = (event.clientY - box.top) / box.height - 0.5;
  }

  function paint(): void {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";

    const tiltX = mouseY * 0.6;
    const tiltY = mouseX * 0.6;

    for (const star of stars) {
      const point = star.p;
      rotate4(point, 0, 3, 0.004 + tiltY * 0.01);
      rotate4(point, 2, 3, 0.003 + tiltX * 0.01);
      rotate4(point, 0, 1, 0.0015);
      rotate4(point, 1, 3, 0.002);

      const wScale = DIST4 / (DIST4 - point[3]);
      const x3 = point[0] * wScale;
      const y3 = point[1] * wScale;
      const z3 = point[2] * wScale;
      const scale = DIST3 / (DIST3 - z3);
      const x = cx + x3 * scale;
      const y = cy + y3 * scale;
      if (
        scale <= 0 ||
        x < -20 ||
        x > width + 20 ||
        y < -20 ||
        y > height + 20
      ) {
        continue;
      }
      const size = Math.max(0.35, 1.8 * scale * wScale * 0.5);
      const alpha = Math.min(0.85, Math.max(0.04, wScale * scale * 0.42));
      ctx.beginPath();
      ctx.fillStyle = `hsla(${String(star.hue)}, 70%, ${String(58 + alpha * 28)}%, ${String(alpha)})`;
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    frame = requestAnimationFrame(paint);
  }

  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  window.addEventListener("mousemove", onMove);
  frame = requestAnimationFrame(paint);

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("mousemove", onMove);
  };
}
