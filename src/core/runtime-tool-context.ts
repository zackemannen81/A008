import { ChatError } from "./errors.js";
import type { ChatToolCall, ChatToolDefinition } from "./types.js";

export const SELECT_TOOLS = "a008_select_tools";
export function runtimeWorkingContext(budgets: {
  chatInputBytes: number; continuationStateBytes: number; continuationReducerInputBytes: number; continuationReducerOutputTokens: number;
}) {
  return { maximumRequestBytes: budgets.chatInputBytes, maximumStateBytes: budgets.continuationStateBytes, reducerInputBytes: budgets.continuationReducerInputBytes, reducerOutputTokens: budgets.continuationReducerOutputTokens, workflowEnabled: true };
}
const selector: ChatToolDefinition = {
  name: SELECT_TOOLS,
  description: "Load full schemas for the next tools you need. Select exact catalog names together in one call; then call those tools normally. Replaces the previously selected set.",
  strict: true,
  parameters: {
    type: "object",
    properties: { names: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 16 } },
    required: ["names"], additionalProperties: false,
  },
};

/** Per-send schema view. It grants no tool execution or approval authority. */
export class RuntimeToolContext {
  readonly catalog: string;
  readonly #all: Map<string, ChatToolDefinition>;
  readonly #always: readonly ChatToolDefinition[];
  #selected: readonly ChatToolDefinition[] = [];

  constructor(definitions: readonly ChatToolDefinition[], always: readonly ChatToolDefinition[] = []) {
    const all = [...definitions, ...always];
    this.#always = always;
    this.#all = new Map(all.map(def => [def.name, def]));
    if (this.#all.size !== all.length || this.#all.has(SELECT_TOOLS))
      throw new ChatError("configuration", "Tool catalog contains duplicate or reserved names.");
    this.catalog = JSON.stringify(all.map(def => ({
      name: def.name,
      description: def.description.slice(0, 240),
    })));
  }

  get selectedNames(): readonly string[] { return this.#selected.map(tool => tool.name); }

  get definitions(): readonly ChatToolDefinition[] {
    return [selector, ...this.#always, ...this.#selected.filter(def => !this.#always.some(item => item.name === def.name))];
  }

  select(call: ChatToolCall): string {
    let parsed: unknown;
    try { parsed = JSON.parse(call.arguments); }
    catch { return JSON.stringify({ error: "Invalid selection JSON; nothing executed." }); }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return JSON.stringify({ error: "Expected {names: [exact catalog names]}; nothing executed." });
    const value = parsed as Record<string, unknown>;
    const names = value.names;
    if (Object.keys(value).length !== 1 || !Array.isArray(names) || names.length < 1 || names.length > 16 ||
        names.some(name => typeof name !== "string" || !this.#all.has(name)) || new Set(names).size !== names.length)
      return JSON.stringify({ error: "Select 1–16 distinct exact catalog names; nothing executed." });
    this.#selected = names.map(name => this.#all.get(name as string)!);
    return JSON.stringify({ selected: names, next: "Schemas are now available; invoke selected tools normally." });
  }
}
