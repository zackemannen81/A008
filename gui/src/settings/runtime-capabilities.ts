import { loadRuntimeCapabilities as loadRuntimeFromClient } from "../../../packages/client/src/index.js";
import type { V2Info } from "../../../packages/protocol/src/index.js";
import { guiHttp } from "../client.js";

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

export const STAGE4_RECOVERY_FEATURES = [
  "session.reconnect-resume",
  "session.restart-uncertainty",
] as const;

export const STAGE4_IMPLEMENTED_FEATURES = [
  ...STAGE4_FOUNDATION_FEATURES,
  ...STAGE4_COMMAND_FEATURES,
  ...STAGE4_RECOVERY_FEATURES,
] as const;

export const STAGE4_REMAINING = [] as const;

export async function loadRuntimeCapabilities(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<V2Info> {
  return loadRuntimeFromClient(guiHttp(fetchImpl), signal);
}

export function stage4FoundationComplete(info: V2Info): boolean {
  const available = new Set(info.features);
  return STAGE4_FOUNDATION_FEATURES.every((feature) => available.has(feature));
}

export function stage4Complete(info: V2Info): boolean {
  const available = new Set(info.features);
  return STAGE4_IMPLEMENTED_FEATURES.every((feature) => available.has(feature));
}
