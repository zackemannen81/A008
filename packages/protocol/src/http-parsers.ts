import {
  memorySnapshotSchema,
  type MemorySnapshot,
  type FrameCheck,
} from "./http-schemas.js";
export function parseMemorySnapshot(value: unknown): MemorySnapshot {
  if (!memorySnapshotSchema.safeParse(value).success)
    throw new Error(
      "The host returned an incompatible memory response. Restart the host with the current A008 build.",
    );
  return value as MemorySnapshot;
}
/** Preserve v1's optimistic frame-probe fallback and malformed-object behavior. */
export function parseFrameCheck(value: unknown, url: string): FrameCheck {
  const payload = value as FrameCheck;
  return {
    url: typeof payload.url === "string" ? payload.url : url,
    embeddable: payload.embeddable !== false,
    ...(typeof payload.reason === "string" ? { reason: payload.reason } : {}),
  };
}
