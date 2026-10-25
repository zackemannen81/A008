import type {
  ContextKnowledgeItem,
  ContextProjection,
  SerializedContextMeasurer,
} from "./types.js";

/** Render content once, preserving null, booleans, conditions and attribution. */
export function knowledgeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null) return "null";
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

/** Shared model-facing allowlist. Identity and state/claim records stay internal. */
export function contextItemsForModel(items: readonly ContextKnowledgeItem[]) {
  return contextItemsForWorker(items);
}

/** Worker/user-message projection: semantic identity plus the retrieved record's readable label. */
export function contextItemsForWorker(items: readonly ContextKnowledgeItem[]) {
  return items.map((item) => ({
    label: item.label ?? item.proposition,
    ...(item.history?.length ? { history: [...item.history] } : {}),
    ...(item.provenance?.length ? { provenance: [...item.provenance] } : {}),
  }));
}

export function serializeContextProjection(
  projection: ContextProjection,
): string {
  return JSON.stringify({
    taskId: projection.taskId,
    items: contextItemsForModel(projection.items),
  });
}

export class Utf8ByteContextMeasurer implements SerializedContextMeasurer {
  readonly unit = "utf8-bytes";

  measure(serializedContext: string): number {
    return Buffer.byteLength(serializedContext, "utf8");
  }
}
