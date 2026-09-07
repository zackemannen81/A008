import { ChatError } from "./errors.js";
import type { SessionParameters } from "./generation-controls.js";
import type { RuntimePreferencesSnapshot } from "./runtime-preferences.js";

export type SessionControl =
  | { readonly action: "inspect" | "reset" | "undo" | "close" }
  | { readonly action: "model"; readonly model: string }
  | { readonly action: "configure"; readonly parameters: unknown }
  | { readonly action: "configureRuntime"; readonly settings: unknown; readonly revision: string };

export interface SessionSnapshot {
  readonly runtimePreferences?: RuntimePreferencesSnapshot;
  readonly model: string;
  readonly parameters: SessionParameters;
  readonly messages: readonly {
    readonly role: "user" | "assistant";
    readonly content: string;
  }[];
  readonly runtime: {
    readonly cwd: string;
    readonly projectId: string | null;
    readonly memoryPath: string | null;
  };
  readonly undone?: boolean;
  readonly closed?: boolean;
}

export function parseSessionControl(value: unknown): SessionControl {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new ChatError("configuration", "Invalid session control.");
  const input = value as Record<string, unknown>;
  switch (input.action) {
    case "inspect":
    case "reset":
    case "undo":
    case "close":
      return { action: input.action };
    case "model":
      if (typeof input.model === "string" && input.model.trim().length > 0)
        return { action: "model", model: input.model };
      break;
    case "configure":
      if ("parameters" in input)
        return { action: "configure", parameters: input.parameters };
      break;
    case "configureRuntime":
      if ("settings" in input && typeof input.revision === "string")
        return { action: "configureRuntime", settings: input.settings, revision: input.revision };
      break;
  }
  throw new ChatError(
    "configuration",
    "Invalid session control action or parameters.",
  );
}
