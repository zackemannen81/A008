export type DesktopAttention = "succeeded" | "failed" | "uncertain";

export interface DesktopAttentionWindow {
  isFocused(): boolean;
  flashFrame(flag: boolean): void;
  setTitle(title: string): void;
}

export interface DesktopAttentionScheduler {
  setTimeout(callback: () => void, milliseconds: number): unknown;
  clearTimeout(handle: unknown): void;
}

const scheduler: DesktopAttentionScheduler = {
  setTimeout: (callback, milliseconds) => globalThis.setTimeout(callback, milliseconds),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Uses native frame attention only when hidden/unfocused and always bounds it. */
export function handleDesktopTitleChange(
  window: DesktopAttentionWindow,
  title: string,
  isAttentionTitle: boolean,
  timers: DesktopAttentionScheduler = scheduler,
  durationMs = 8_000,
): () => void {
  window.setTitle(title);
  if (!isAttentionTitle || window.isFocused()) {
    window.flashFrame(false);
    return () => undefined;
  }
  window.flashFrame(true);
  const timeout = timers.setTimeout(() => window.flashFrame(false), durationMs);
  return () => {
    timers.clearTimeout(timeout);
    window.flashFrame(false);
  };
}
