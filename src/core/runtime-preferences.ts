import type {
  RuntimePreferences as WireRuntimePreferences,
  RuntimeBudgetField as WireRuntimeBudgetField,
  RuntimePreferencesSnapshot as WireRuntimePreferencesSnapshot,
} from "../../packages/protocol/src/index.js";
import {
  DEFAULT_MEMORY_LIFECYCLE_POLICY,
  parseMemoryLifecyclePolicy,
  type MemoryLifecyclePolicy,
} from "./memory-lifecycle-policy.js";
import { ChatError } from "./errors.js";

/** Local limits. Units intentionally distinguish serialized bytes from tokens. */
export const DEFAULT_RUNTIME_BUDGETS = Object.freeze({
  chatInputBytes: 131_072,
  memoryProjectionBytes: 32_768,
  recentMessages: 2,
  semanticInputBytes: 262_144,
  semanticOutputTokens: 16_384,
  stagingBytes: 262_144,
  maximumProposals: 128,
  maximumTagsPerProposal: 16,
  maximumDomainsPerProposal: 8,
  maximumEntitiesPerProposal: 16,
  maximumScopeDomains: 32,
  retrievalVocabulary: 200,
  retrievalEntities: 8,
  retrievalTerms: 16,
  retrievalHistoryMessages: 2,
  retrievalHistoryCharacters: 1_000,
  retrievalSemanticQueries: 3,
  providerTimeoutMs: 180_000,
  maximumToolCalls: 12,
  maximumToolDefinitions: 128,
  toolOutputBytes: 65_536,
  toolTimeoutMs: 60_000,
});
export type RuntimeBudgetKey = keyof typeof DEFAULT_RUNTIME_BUDGETS;
export type RuntimeBudgets = { readonly [K in RuntimeBudgetKey]: number };
export type RuntimePreferences = WireRuntimePreferences & {
  readonly memoryLifecycle?: MemoryLifecyclePolicy;
  readonly budgets: RuntimeBudgets;
};
export type RuntimeBudgetField = Omit<WireRuntimeBudgetField, "key"> & {
  readonly key: RuntimeBudgetKey;
};
const field = (
  key: RuntimeBudgetKey,
  label: string,
  unit: string,
  description: string,
  minimum = 1,
  maximum = Number.MAX_SAFE_INTEGER,
): RuntimeBudgetField => ({ key, label, unit, description, minimum, maximum });

export const RUNTIME_BUDGET_FIELDS: readonly RuntimeBudgetField[] =
  Object.freeze([
    field(
      "chatInputBytes",
      "Chat input budget",
      "UTF-8 bytes",
      "Complete serialized messages: system instructions, recent dialogue, retrieved memory and your message. Separate from generated tokens.",
    ),
    field(
      "memoryProjectionBytes",
      "Memory projection budget",
      "UTF-8 bytes",
      "Retrieved memory selected for a chat turn. Omitted records remain stored; one oversized record can exceed this target.",
    ),
    field(
      "recentMessages",
      "Recent dialogue",
      "messages",
      "Prior user and assistant messages sent with each question. 2 means one pair; 0 sends none. Stored conversation history is preserved.",
      0,
    ),
    field(
      "semanticInputBytes",
      "Semantic input budget",
      "UTF-8 bytes",
      "Complete request for retrieval scope, knowledge extraction and relation classification.",
    ),
    field(
      "semanticOutputTokens",
      "Semantic output budget",
      "tokens",
      "Requested tokens for memory JSON. Each call uses the lower of this value and its model's supported output limit.",
    ),
    field(
      "stagingBytes",
      "Extracted batch budget",
      "UTF-8 bytes",
      "Serialized proposals accepted from one extraction.",
    ),
    field(
      "maximumProposals",
      "Proposals per extraction",
      "proposals",
      "Each proposal can require a separate classification call.",
    ),
    field(
      "maximumTagsPerProposal",
      "Tags per proposal",
      "tags",
      "Maximum labels accepted on each extracted proposal.",
    ),
    field(
      "maximumDomainsPerProposal",
      "Domains per proposal",
      "domains",
      "Maximum subject areas accepted on each extracted proposal.",
    ),
    field(
      "maximumEntitiesPerProposal",
      "Entities per proposal",
      "entities",
      "Maximum entity labels accepted on each extracted proposal.",
    ),
    field(
      "maximumScopeDomains",
      "Discussion scope",
      "domains",
      "Maximum accumulated domains per conversation. Least recently reinforced domains are evicted.",
    ),
    field(
      "retrievalVocabulary",
      "Offered vocabulary",
      "labels/axis",
      "Maximum stored domains and tags offered to the retrieval scope classifier.",
    ),
    field(
      "retrievalEntities",
      "Retrieval entities",
      "entities",
      "Maximum entity hints extracted from the current message.",
    ),
    field(
      "retrievalTerms",
      "Retrieval terms",
      "terms",
      "Maximum lexical terms in the retrieval plan.",
    ),
    field(
      "retrievalHistoryMessages",
      "Retrieval planning history",
      "messages",
      "Maximum recent messages used by the planner, within Recent dialogue.",
      0,
    ),
    field(
      "retrievalHistoryCharacters",
      "Retrieval history length",
      "characters/message",
      "Maximum characters of each prior message used by the planner.",
    ),
    field(
      "retrievalSemanticQueries",
      "Planned semantic queries",
      "queries",
      "Maximum query variants in the retrieval plan. Vector retrieval is not enabled in the live knowledge reader.",
    ),
    field(
      "providerTimeoutMs",
      "Provider request timeout",
      "milliseconds",
      "Time allowed for each chat or memory provider call.",
      1_000,
      2_147_483_647,
    ),
    field(
      "maximumToolCalls",
      "Tool calls per turn",
      "calls",
      "Approved or denied model tool calls before a turn stops. Each call needs explicit approval.",
    ),
    field(
      "maximumToolDefinitions",
      "Available tools",
      "tools",
      "Maximum native and approved MCP tools offered to the model. An oversized catalog fails visibly.",
    ),
    field(
      "toolOutputBytes",
      "Tool result budget",
      "UTF-8 bytes",
      "Maximum observation text returned from each tool. Longer output is marked as truncated.",
    ),
    field(
      "toolTimeoutMs",
      "Tool execution timeout",
      "milliseconds",
      "Time for each shell command or MCP request, excluding user approval.",
      1,
      2_147_483_647,
    ),
  ]);

export type RuntimePreferencesSnapshot = Omit<
  WireRuntimePreferencesSnapshot,
  "settings" | "defaults" | "fields"
> & {
  readonly settings: RuntimePreferences;
  readonly defaults: RuntimePreferences;
  readonly fields: readonly RuntimeBudgetField[];
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseRuntimePreferences(value: unknown): RuntimePreferences {
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (k) => !["instructions", "budgets", "memoryLifecycle"].includes(k),
    ) ||
    typeof value.instructions !== "string" ||
    !isRecord(value.budgets) ||
    Object.keys(value.budgets).length !== RUNTIME_BUDGET_FIELDS.length
  ) {
    throw new ChatError(
      "configuration",
      "Invalid runtime settings. Reload Global settings and try again.",
    );
  }
  const budgets = {} as Record<RuntimeBudgetKey, number>;
  for (const field of RUNTIME_BUDGET_FIELDS) {
    const n = value.budgets[field.key];
    if (
      typeof n !== "number" ||
      !Number.isSafeInteger(n) ||
      n < field.minimum ||
      n > field.maximum
    ) {
      throw new ChatError(
        "configuration",
        `${field.label} must be a whole number between ${field.minimum} and ${field.maximum} ${field.unit}.`,
      );
    }
    budgets[field.key] = n;
  }
  try {
    return {
      instructions: value.instructions.trim(),
      budgets,
      memoryLifecycle: parseMemoryLifecyclePolicy(
        value.memoryLifecycle ?? DEFAULT_MEMORY_LIFECYCLE_POLICY,
      ),
    };
  } catch {
    throw new ChatError("configuration", "Invalid memory lifecycle policy.");
  }
}
