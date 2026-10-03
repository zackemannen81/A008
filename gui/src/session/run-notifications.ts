import type { PlatformV3RunStatus } from "../../../packages/protocol/src/index.js";

const ACTIVE_STATUSES = new Set<string>([
  "queued",
  "running",
  "cancel_requested",
]);

export type RunOutcome = "succeeded" | "failed" | "uncertain";

export interface ObservedRun {
  readonly id: string;
  readonly status: string;
}

/** Emits only a terminal edge following an active state for the same run. */
export class RunOutcomeTracker {
  #current: ObservedRun | undefined;

  observe(run: ObservedRun | undefined): RunOutcome | undefined {
    if (!run) {
      this.#current = undefined;
      return undefined;
    }
    const previous = this.#current;
    this.#current = run;
    if (!previous || previous.id !== run.id) return undefined;
    if (!ACTIVE_STATUSES.has(previous.status)) return undefined;
    if (run.status === "succeeded") return "succeeded";
    if (run.status === "failed") return "failed";
    if (run.status === "needs_reconciliation") return "uncertain";
    return undefined;
  }
}

export interface AttentionDocument {
  title: string;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
  readonly visibilityState: string;
}

export interface AttentionWindow {
  addEventListener(type: "focus", listener: () => void): void;
  removeEventListener(type: "focus", listener: () => void): void;
}

export interface AttentionScheduler {
  setInterval(callback: () => void, milliseconds: number): unknown;
  clearInterval(handle: unknown): void;
  setTimeout(callback: () => void, milliseconds: number): unknown;
  clearTimeout(handle: unknown): void;
}

const defaultScheduler: AttentionScheduler = {
  setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Blinks a short outcome in the document title, restoring on focus or timeout. */
export function startTitleAttention(
  document: AttentionDocument,
  window: AttentionWindow,
  outcome: RunOutcome,
  scheduler: AttentionScheduler = defaultScheduler,
  durationMs = 8_000,
): () => void {
  const originalTitle = document.title;
  const notice = notificationTitle(outcome, originalTitle);
  let showingNotice = false;
  let finished = false;
  let interval: unknown;
  let timeout: unknown;
  const stop = () => {
    if (finished) return;
    finished = true;
    if (interval !== undefined) scheduler.clearInterval(interval);
    if (timeout !== undefined) scheduler.clearTimeout(timeout);
    document.title = originalTitle;
    window.removeEventListener("focus", stop);
    document.removeEventListener("visibilitychange", onVisibility);
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") stop();
  };
  window.addEventListener("focus", stop);
  document.addEventListener("visibilitychange", onVisibility);
  interval = scheduler.setInterval(() => {
    showingNotice = !showingNotice;
    document.title = showingNotice ? notice : originalTitle;
  }, 700);
  timeout = scheduler.setTimeout(stop, durationMs);
  return stop;
}

export interface ToneContext {
  readonly currentTime: number;
  resume(): Promise<void>;
  createOscillator(): {
    frequency: { value: number };
    connect(destination: unknown): void;
    start(when?: number): void;
    stop(when?: number): void;
  };
  createGain(): {
    gain: { setValueAtTime(value: number, time: number): void; exponentialRampToValueAtTime(value: number, time: number): void };
    connect(destination: unknown): void;
  };
  readonly destination: unknown;
}

/** Plays a brief local tone when enabled; autoplay/API failures are non-fatal. */
export async function playOutcomeTone(
  enabled: boolean,
  outcome: RunOutcome,
  createContext: () => ToneContext = () => {
    const AudioContextConstructor = globalThis.AudioContext;
    if (!AudioContextConstructor) throw new Error("Audio is unavailable.");
    return new AudioContextConstructor() as unknown as ToneContext;
  },
): Promise<void> {
  if (!enabled) return;
  try {
    const context = createContext();
    await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = outcome === "succeeded" ? 660 : 330;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
  } catch {
    // Browser autoplay and audio-device failures never affect run observation.
  }
}

export function notificationTitle(outcome: RunOutcome, title: string): string {
  const notice = outcome === "succeeded"
    ? "✓ Turn klar"
    : outcome === "uncertain"
      ? "⚠ Turn osäker"
      : "⚠ Turn misslyckades";
  return `A008_NOTIFICATION:${notice} — ${title}`;
}

export function notificationMessage(outcome: RunOutcome): string {
  if (outcome === "succeeded") return "Turn klar.";
  if (outcome === "uncertain") return "Turnens utfall är osäkert och behöver granskas.";
  return "Turnen misslyckades.";
}
