import { ChatError } from "../core/errors.js";
import type { ProjectionResult } from "../memory/types.js";
import { contextItemsForWorker } from "../memory/serialization.js";
export { MEMORY_CONTEXT_SYSTEM_INSTRUCTION } from "../prompt-contracts/MEMORY_CONTEXT_SYSTEM_INSTRUCTION.js";
import { MEMORY_CONTEXT_SYSTEM_INSTRUCTION } from "../prompt-contracts/MEMORY_CONTEXT_SYSTEM_INSTRUCTION.js";

export const MEMORY_CONTEXT_ENVELOPE_VERSION = "A008_memory_context_v2";

export interface MemoryPrompt {
  readonly systemInstruction: string;
  readonly userEnvelope: string;
}

export interface MemoryPromptComposer {
  compose(projection: ProjectionResult, originalMessage: string): MemoryPrompt;
}

function nonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ChatError("configuration", `${field} must not be empty.`);
  }
  return normalized;
}

export class DeterministicMemoryPromptComposer implements MemoryPromptComposer {
  compose(projection: ProjectionResult, originalMessage: string): MemoryPrompt {
    const message = nonEmpty(originalMessage, "Original message");
    const items = contextItemsForWorker(projection.projection.items);
    for (const [index, item] of items.entries()) {
      nonEmpty(item.label, `Projected memory item ${index + 1} label`);
    }
    return {
      systemInstruction: MEMORY_CONTEXT_SYSTEM_INSTRUCTION,
      userEnvelope: JSON.stringify({
        version: MEMORY_CONTEXT_ENVELOPE_VERSION,
        retrievedContext: { items },
        message,
      }),
    };
  }
}
