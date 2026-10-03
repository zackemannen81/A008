/** Cyberpunk Dotted Metaballs FX engine for the empty chat pane. */

const TRIG_LUT_SIZE = 2048;
const TRIG_LUT_MASK = TRIG_LUT_SIZE - 1;
const TRIG_LUT_QUARTER = TRIG_LUT_SIZE >> 2;
const TRIG_LUT_SCALE = TRIG_LUT_SIZE / (Math.PI * 2);
const SIN_LUT = new Float32Array(TRIG_LUT_SIZE);

for (let index = 0; index < TRIG_LUT_SIZE; index += 1) {
  SIN_LUT[index] = Math.sin((index / TRIG_LUT_SIZE) * Math.PI * 2);
}

function trigIndex(angle: number): number {
  return ((angle * TRIG_LUT_SCALE) | 0) & TRIG_LUT_MASK;
}
function fastSin(angle: number): number {
  return SIN_LUT[trigIndex(angle)] ?? 0;
}
function fastCos(angle: number): number {
  return SIN_LUT[(trigIndex(angle) + TRIG_LUT_QUARTER) & TRIG_LUT_MASK] ?? 0;
}

export function startCyberpunkFx(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  options: { readonly reducedMotion?: boolean } = {},
): () => void {
  const context = canvas.getContext("2d");
  if (context === null || options.reducedMotion) {
    return () => undefined;
  }
  const ctx = context;

  let width = 0;
  let height = 0;
  let frame = 0;
  let time = 0;

  const FX_WIDTH = 64;
  const FX_HEIGHT = 64;
  const fxBuffer = new Uint8ClampedArray(FX_WIDTH * FX_HEIGHT * 4);
  const fxImage = new ImageData(FX_WIDTH, FX_HEIGHT);

  const offscreen = document.createElement("canvas");
  offscreen.width = FX_WIDTH;
  offscreen.height = FX_HEIGHT;
  const offCtx = offscreen.getContext("2d");

  function resize(): void {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    canvas.width = width;
    canvas.height = height;
  }

  function paint(): void {
    time += 0.2;

    // Rensa bufferten helt mörk varje frame
    fxBuffer.fill(0);

    const balls: readonly [number, number, number][] = [
      [
        FX_WIDTH * 0.35 + fastSin(time * 0.031) * 25,
        FX_HEIGHT * 0.35 + fastCos(time * 0.027) * 15,
        65 ,
      ],
      [
        FX_WIDTH * 0.65 + fastCos(time * 0.023) * 30,
        FX_HEIGHT * 0.4 + fastSin(time * 0.041) * 18,
        50 ,
      ],
      [
        FX_WIDTH * 0.5 + fastSin(time * 0.017 + 2.1) * 20,
        FX_HEIGHT * 0.6 + fastCos(time * 0.035 + 1.2) * 20,
        55 ,
      ],
    ];

    // Dotted loop med förskjutning på varannan rad (j % 2)
    for (let j = 0; j < FX_HEIGHT; j += 2) {
      //const xOffset = (j % 2); // Förskjuter varannan rad en pixel i sidled
      const xOffset = 0;//
      for (let i = 0; i < FX_WIDTH; i += 2) {
        const x = i + xOffset;
        if (x >= FX_WIDTH) continue;

        let field = 0;
        for (const ball of balls) {
          const dx = x - ball[0];
          const dy = j - ball[1];
          field += ball[2] / (dx * dx + dy * dy + 4);
        }

        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;

        if (field > 2.8) {
           r = 255; g = 0; b = 128; a = 128;
        } else if (field > 1.75) {
           r = 255; g = 0; b = 128; a = 64;
        } else if (field > 1.05) {
           r = 255; g = 0; b = 128; a = 32;
        } else if (field > 0.45) {
           r = 255; g = 0; b = 128; a = 16;
        }

        if (a > 0) {
          const pixel = (j * FX_WIDTH + x) * 4;
          fxBuffer[pixel] = r;
          fxBuffer[pixel + 1] = g;
          fxBuffer[pixel + 2] = b;
          fxBuffer[pixel + 3] = a;
        }
      }
    }

    fxImage.data.set(fxBuffer);
    if (offCtx) {
      offCtx.putImageData(fxImage, 0, 0);
    }

    // Skala upp skärmen (utan smoothing för att behålla den skarpa pixelkänslan)
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, 0, 0, width, height);

    frame = requestAnimationFrame(paint);
  }

  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  frame = requestAnimationFrame(paint);

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
  };
}