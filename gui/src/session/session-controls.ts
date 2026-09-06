/** Renderer-owned wire contract, ADR 0026. No runtime/provider imports. */
export interface SessionParameters {
  stream: boolean;
  temperature: number | null;
  topP: number | null;
  maxTokens: number;
  enableThinking: boolean | null;
  reasoningBudget: number | null;
  reasoningEffort: string | null;
  seed: number | null;
  stop: readonly string[] | null;
}
export interface GenerationCapabilities {
  maxTokens: number;
  topP: boolean;
  thinking: boolean;
  reasoningBudget: number | null;
  reasoningEfforts: readonly string[];
  seed: boolean;
  stop: boolean;
  verifiedOn: string;
}
export interface GuiModel {
  id: string;
  name: string;
  defaults: SessionParameters;
  capabilities: GenerationCapabilities;
}
export type SessionControl =
  | { action: "inspect" | "reset" | "undo" | "close" }
  | { action: "model"; model: string }
  | { action: "configure"; parameters: SessionParameters };
export interface SessionSnapshot {
  model: string;
  parameters: SessionParameters;
  messages: readonly { role: "user" | "assistant"; content: string }[];
  runtime: { cwd: string; projectId: string | null; memoryPath: string | null };
  undone?: boolean;
  closed?: boolean;
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
export function isParameters(v: unknown): v is SessionParameters {
  return (
    record(v) &&
    typeof v.stream === "boolean" &&
    finite(v.maxTokens) &&
    [v.temperature, v.topP, v.reasoningBudget, v.seed].every(
      (n) => n === null || finite(n),
    ) &&
    (v.enableThinking === null || typeof v.enableThinking === "boolean") &&
    (v.reasoningEffort === null || typeof v.reasoningEffort === "string") &&
    (v.stop === null ||
      (Array.isArray(v.stop) && v.stop.every((s) => typeof s === "string")))
  );
}
export function parseSessionSnapshot(v: unknown): SessionSnapshot {
  if (
    !record(v) ||
    typeof v.model !== "string" ||
    !isParameters(v.parameters) ||
    !Array.isArray(v.messages) ||
    !v.messages.every(
      (m) =>
        record(m) &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    ) ||
    !record(v.runtime) ||
    typeof v.runtime.cwd !== "string" ||
    ![v.runtime.projectId, v.runtime.memoryPath].every(
      (s) => s === null || typeof s === "string",
    ) ||
    (v.undone !== undefined && typeof v.undone !== "boolean") ||
    (v.closed !== undefined && typeof v.closed !== "boolean")
  ) {
    throw new Error("Host sent an invalid session snapshot.");
  }
  return v as unknown as SessionSnapshot;
}
export async function loadModels(
  signal?: AbortSignal,
): Promise<readonly GuiModel[]> {
  const response = await fetch("/v1/models", { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Cannot load models (${response.status}).`);
  const body: unknown = await response.json();
  if (
    !record(body) ||
    !Array.isArray(body.models) ||
    !body.models.every((m) => {
      if (
        !record(m) ||
        typeof m.id !== "string" ||
        typeof m.name !== "string" ||
        !isParameters(m.defaults) ||
        !record(m.capabilities)
      )
        return false;
      const c = m.capabilities;
      return (
        finite(c.maxTokens) &&
        [c.topP, c.thinking, c.seed, c.stop].every(
          (b) => typeof b === "boolean",
        ) &&
        (c.reasoningBudget === null || finite(c.reasoningBudget)) &&
        Array.isArray(c.reasoningEfforts) &&
        c.reasoningEfforts.every((s) => typeof s === "string") &&
        typeof c.verifiedOn === "string"
      );
    })
  )
    throw new Error(
      "Model parameter metadata is unavailable. Restart the current A008 host.",
    );
  return body.models as GuiModel[];
}
