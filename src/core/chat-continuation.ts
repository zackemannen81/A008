import { ChatError } from "./errors.js";
import type { ChatWireMessage } from "./types.js";

export const RUN_CONTINUATION_STATE_VERSION =
  "a008_run_continuation_state_v1" as const;

export interface RunContinuationEntry {
  readonly id: string;
  readonly statement: string;
  readonly sourceRefs: readonly string[];
}

/** Temporary, run-local continuation context; never semantic memory. */
export interface RunContinuationState {
  readonly version: typeof RUN_CONTINUATION_STATE_VERSION;
  readonly runId: string;
  readonly verifiedFacts: readonly RunContinuationEntry[];
  readonly hypotheses: readonly RunContinuationEntry[];
  readonly completedActions: readonly RunContinuationEntry[];
}

/** A complete provider tool round retained as the raw source of continuation evidence. */
export interface RunToolInteraction {
  readonly id: string;
  readonly messages: readonly ChatWireMessage[];
}

export interface RunContinuationRouteBudget {
  /** Soft pressure trigger, strictly below the finite hard ceiling. */
  readonly pressureBytes: number;
  /** Runtime-owned hard ceiling for the selected route's serialized request. */
  readonly maximumBytes: number;
  /** Explicit bound for the reducer's tool-free serialized request. */
  readonly reducerInputBytes: number;
  /** Finite generation cap for the reducer call. */
  readonly reducerOutputTokens: number;
}

export interface RunContinuationCheckpointWrite {
  readonly runId: string;
  readonly state: RunContinuationState;
  readonly sourceInteractions: readonly RunToolInteraction[];
  readonly maximumStateBytes: number;
  readonly recovery?: RunContinuationRecovery;
}

/** Rebuild data for a completed boundary, never a list of operations to execute. */
export interface RunContinuationRecovery {
  readonly version: 1;
  readonly state: RunContinuationState;
  readonly recentInteractions: readonly RunToolInteraction[];
  readonly completedInteractions: number;
  readonly usedToolCallIds: readonly string[];
  readonly routeId: string;
}

export interface RunContinuationRecoveryBridge {
  readonly resume?: RunContinuationRecovery;
  /** Must be acknowledged durably before a tool or post-output effect starts. */
  readonly beforeEffect: () => Promise<void>;
}

export function validateContinuationRecovery(
  value: RunContinuationRecovery,
  maximumStateBytes: number,
): RunContinuationRecovery {
  if (value.version !== 1 || !Number.isSafeInteger(value.completedInteractions) ||
      value.completedInteractions < 1 || !Array.isArray(value.recentInteractions) ||
      value.recentInteractions.length >= value.completedInteractions ||
      !Array.isArray(value.usedToolCallIds) || value.usedToolCallIds.some(id => typeof id !== "string" || !id || id.length > 256) ||
      new Set(value.usedToolCallIds).size !== value.usedToolCallIds.length ||
      value.usedToolCallIds.length < value.completedInteractions ||
      typeof value.routeId !== "string" || !value.routeId) {
    invalid("invalid recovery boundary.");
  }
  const compacted = value.completedInteractions - value.recentInteractions.length;
  const refs = new Set(Array.from({ length: compacted }, (_, i) => `${value.state.runId}:${i + 1}`));
  validateRunContinuationState(value.state, { runId: value.state.runId, validSourceRefs: refs, requiredSourceRefs: refs, maximumBytes: maximumStateBytes });
  const tailIds = new Set<string>();
  for (const [i, interaction] of value.recentInteractions.entries()) {
    if (interaction.id !== `${value.state.runId}:${compacted + i + 1}` || !Array.isArray(interaction.messages)) invalid("invalid raw tail sequence.");
    const first = interaction.messages[0];
    if (!first || first.role !== "assistant" || !("toolCalls" in first) || !first.toolCalls.length || interaction.messages.length !== first.toolCalls.length + 1) invalid("unfinished raw tail.");
    for (const [j, call] of first.toolCalls.entries()) {
      const result = interaction.messages[j + 1];
      if (!value.usedToolCallIds.includes(call.id) || tailIds.has(call.id) ||
          typeof call.name !== "string" || typeof call.arguments !== "string" ||
          result?.role !== "tool" || result.toolCallId !== call.id || typeof result.content !== "string") invalid("invalid raw tail tool binding.");
      tailIds.add(call.id);
    }
  }
  return structuredClone(value);
}

export interface RunContinuationPressurePolicy {
  readonly routeBudget: RunContinuationRouteBudget;
  /** Persist the validated checkpoint before an eligible projection is adopted. */
  readonly persistCheckpoint: (
    input: RunContinuationCheckpointWrite,
  ) => Promise<void>;
}

export function validateContinuationPressure(
  policy: RunContinuationPressurePolicy,
): void {
  const budget = policy.routeBudget;
  if (
    !Number.isSafeInteger(budget.pressureBytes) || budget.pressureBytes < 1 ||
    !Number.isSafeInteger(budget.maximumBytes) || budget.maximumBytes <= budget.pressureBytes ||
    !Number.isSafeInteger(budget.reducerInputBytes) || budget.reducerInputBytes < 1 ||
    !Number.isSafeInteger(budget.reducerOutputTokens) || budget.reducerOutputTokens < 1 ||
    typeof policy.persistCheckpoint !== "function"
  ) {
    throw new ChatError("configuration", "Invalid finite continuation route budget.");
  }
}

export interface RunContinuationPolicy {
  readonly recovery?: RunContinuationRecoveryBridge;
  /** Number of newest completed tool rounds that always remain raw in provider context. */
  readonly recentRawInteractions: number;
  /** Maximum UTF-8 size of the serialized continuation state. */
  readonly maximumStateBytes: number;
  /** Enables soft-pressure checks and durable candidate adoption for Task 3. */
  readonly pressure?: RunContinuationPressurePolicy;
  /** Reduce eligible completed rounds into a replacement state. */
  readonly compact: (input: {
    readonly runId: string;
    readonly previous: RunContinuationState | null;
    readonly interactions: readonly RunToolInteraction[];
    readonly maximumInputBytes?: number;
    readonly maximumOutputTokens?: number;
    readonly toolsEnabled?: false;
  }) => Promise<unknown>;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(detail: string): never {
  throw new ChatError(
    "invalid_response",
    `Invalid run continuation state: ${detail}`,
  );
}

function parseEntries(
  value: unknown,
  field: string,
  runId: string,
  validSources: ReadonlySet<string>,
  seenIds: Set<string>,
): RunContinuationEntry[] {
  if (!Array.isArray(value)) invalid(`${field} must be an array.`);
  return value.map((item, index) => {
    if (
      !isRecord(item) ||
      Object.keys(item).some(
        (key) => !["id", "statement", "sourceRefs"].includes(key),
      ) ||
      typeof item.id !== "string" ||
      item.id.trim().length === 0 ||
      item.id.length > 200 ||
      typeof item.statement !== "string" ||
      item.statement.trim().length === 0 ||
      !Array.isArray(item.sourceRefs) ||
      item.sourceRefs.length === 0 ||
      item.sourceRefs.some(
        (source) => typeof source !== "string" || !validSources.has(source),
      )
    ) {
      invalid(
        `${field}[${index}] must have a statement and resolvable sourceRefs.`,
      );
    }
    const id = item.id;
    if (seenIds.has(id)) invalid(`duplicate entry id ${id}.`);
    seenIds.add(id);
    const sourceRefs = item.sourceRefs as string[];
    if (new Set(sourceRefs).size !== sourceRefs.length) {
      invalid(`${field}[${index}] contains duplicate sourceRefs.`);
    }
    return {
      id,
      statement: item.statement,
      sourceRefs: [...sourceRefs],
    };
  });
}

/** Validate, detach and byte-bound reducer output before it can replace live state. */
export function validateRunContinuationState(
  value: unknown,
  input: {
    readonly runId: string;
    readonly validSourceRefs: ReadonlySet<string>;
    readonly requiredSourceRefs?: ReadonlySet<string>;
    readonly maximumBytes: number;
  },
): RunContinuationState {
  if (
    !Number.isSafeInteger(input.maximumBytes) ||
    input.maximumBytes < 1 ||
    !isRecord(value) ||
    Object.keys(value).some(
      (key) =>
        ![
          "version",
          "runId",
          "verifiedFacts",
          "hypotheses",
          "completedActions",
        ].includes(key),
    ) ||
    value.version !== RUN_CONTINUATION_STATE_VERSION ||
    value.runId !== input.runId
  ) {
    invalid("unsupported version, run binding, or object shape.");
  }
  const seenIds = new Set<string>();
  const state: RunContinuationState = {
    version: RUN_CONTINUATION_STATE_VERSION,
    runId: input.runId,
    verifiedFacts: parseEntries(
      value.verifiedFacts,
      "verifiedFacts",
      input.runId,
      input.validSourceRefs,
      seenIds,
    ),
    hypotheses: parseEntries(
      value.hypotheses,
      "hypotheses",
      input.runId,
      input.validSourceRefs,
      seenIds,
    ),
    completedActions: parseEntries(
      value.completedActions,
      "completedActions",
      input.runId,
      input.validSourceRefs,
      seenIds,
    ),
  };
  const requiredSources = input.requiredSourceRefs ?? new Set<string>();
  for (const source of requiredSources) {
    if (!input.validSourceRefs.has(source)) {
      invalid(`required source ${source} is not retained by this run.`);
    }
  }
  const suppliedSources = new Set(
    [state.verifiedFacts, state.hypotheses, state.completedActions]
      .flat()
      .flatMap((entry) => entry.sourceRefs),
  );
  for (const source of requiredSources) {
    if (!suppliedSources.has(source)) {
      invalid(`continuation state dropped required source ${source}.`);
    }
  }
  const serialized = JSON.stringify(state);
  if (Buffer.byteLength(serialized, "utf8") > input.maximumBytes) {
    invalid(`serialized state exceeds ${input.maximumBytes} UTF-8 bytes.`);
  }
  return state;
}

export function serializeRunContinuationState(
  state: Pick<
    RunContinuationState,
    "version" | "verifiedFacts" | "hypotheses" | "completedActions"
  >,
): string {
  return JSON.stringify({
    version: state.version,
    verifiedFacts: state.verifiedFacts,
    hypotheses: state.hypotheses,
    completedActions: state.completedActions,
  });
}
