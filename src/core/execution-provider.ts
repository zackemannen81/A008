import { ChatError } from "./errors.js";
import { defaultModelRegistry } from "./model-registry.js";
import type { ExecutionProvider } from "./types.js";
import { isKieChatModelId } from "../providers/kie/kie-models.js";

export type { ExecutionProvider } from "./types.js";

export function isExecutionProvider(value: string): value is ExecutionProvider {
  return value === "openai" || value === "nvidia" || value === "kie";
}

export function catalogExecutionProvider(provider: string): ExecutionProvider {
  return provider === "openai" || provider === "kie" ? provider : "nvidia";
}

export function acmeProviderHint(
  executionProvider: ExecutionProvider,
  model: string,
): string {
  return executionProvider === "kie" ? `kie:${model}` : executionProvider;
}

export function resolveExecutionProvider(
  model: string,
  catalog?: {
    readonly chatModels: readonly { readonly id: string; readonly provider: string }[];
  },
): ExecutionProvider {
  const shipped = defaultModelRegistry.get(model)?.executionProvider;
  if (shipped !== undefined) {
    return shipped;
  }
  if (isKieChatModelId(model)) {
    return "kie";
  }
  const entry = catalog?.chatModels.find((item) => item.id === model);
  if (entry !== undefined) {
    return catalogExecutionProvider(entry.provider);
  }
  throw new ChatError("configuration", `No executionProvider for model ${model}.`);
}
