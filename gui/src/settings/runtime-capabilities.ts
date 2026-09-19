import {
  v2InfoSchema,
  type V2Info,
} from "../../../packages/protocol/src/index.js";

export const STAGE4_FOUNDATION_FEATURES = [
  "session.turn-identity",
  "session.message-identity",
  "session.event-sequence",
  "session.snapshot-boundary",
  "session.terminal-outcomes",
] as const;

export const STAGE4_COMMAND_FEATURES = [
  "session.command-receipts",
  "session.command-idempotency",
] as const;

export const STAGE4_RECOVERY_FEATURES = ["session.reconnect-resume"] as const;

export const STAGE4_IMPLEMENTED_FEATURES = [
  ...STAGE4_FOUNDATION_FEATURES,
  ...STAGE4_COMMAND_FEATURES,
  ...STAGE4_RECOVERY_FEATURES,
] as const;

export const STAGE4_REMAINING = ["Restart uncertainty handling"] as const;

export async function loadRuntimeCapabilities(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<V2Info> {
  const response = await fetchImpl("/v2/info", {
    headers: { accept: "application/json" },
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `V2 discovery is unavailable in this host mode (${response.status}).`,
    );
  }
  const parsed = v2InfoSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("V2 discovery metadata is incompatible with this GUI.");
  }
  return parsed.data;
}

export function stage4FoundationComplete(info: V2Info): boolean {
  const available = new Set(info.features);
  return STAGE4_FOUNDATION_FEATURES.every((feature) => available.has(feature));
}
