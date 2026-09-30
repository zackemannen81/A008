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

/** Extractor-facing projection. Keep engine-oriented state/claim semantics here. */
export function contextItemsForModel(items: readonly ContextKnowledgeItem[]) {
  return items.map((item) => ({
    id: item.id,
    ...(item.semanticAddress === undefined
      ? {}
      : { semanticAddress: item.semanticAddress }),
    ...(item.kind === "state"
      ? {
          currentState: knowledgeText(
            item.currentState === undefined
              ? item.proposition
              : item.currentState,
          ),
        }
      : { claim: item.proposition }),
    ...(item.history?.length ? { history: [...item.history] } : {}),
    ...(item.provenance?.length ? { provenance: [...item.provenance] } : {}),
  }));
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
