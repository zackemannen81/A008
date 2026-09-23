import type { ContextProjection, SerializedContextMeasurer } from "./types.js";

export function serializeContextProjection(
  projection: ContextProjection,
): string {
  return JSON.stringify({
    taskId: projection.taskId,
    items: projection.items.map((item) => ({
      id: item.id,
      ...(item.semanticAddress === undefined
        ? {}
        : { semanticAddress: item.semanticAddress }),
      ...(item.evidenceId === undefined ? {} : { evidenceId: item.evidenceId }),
      ...(item.currentState === undefined
        ? {}
        : { currentState: item.currentState }),
      proposition: item.proposition,
      kind: item.kind,
      tags: [...item.tags],
      scope: [...item.scope],
      authority: item.authority,
    })),
  });
}

export class Utf8ByteContextMeasurer implements SerializedContextMeasurer {
  readonly unit = "utf8-bytes";

  measure(serializedContext: string): number {
    return Buffer.byteLength(serializedContext, "utf8");
  }
}
