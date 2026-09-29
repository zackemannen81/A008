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

export interface RunContinuationPolicy {
  /** Number of newest completed tool rounds that always remain raw in provider context. */
  readonly recentRawInteractions: number;
  /** Maximum UTF-8 size of the serialized continuation state. */
  readonly maximumStateBytes: number;
  /** Reduce eligible completed rounds into a replacement state. */
  readonly compact: (input: {
    readonly runId: string;
    readonly previous: RunContinuationState | null;
    readonly interactions: readonly RunToolInteraction[];
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
