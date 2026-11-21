import { ChatError } from "./errors.js";
import {
  validateRunContinuationState,
  RUN_CONTINUATION_STATE_VERSION,
  type RunContinuationEntry,
  type RunContinuationState,
  type RunToolInteraction,
} from "./chat-continuation.js";

interface EvidenceInput {
  readonly runId: string;
  readonly previous: RunContinuationState | null;
  readonly interactions: readonly RunToolInteraction[];
  readonly validSourceRefs: ReadonlySet<string>;
  readonly requiredSourceRefs: ReadonlySet<string>;
  readonly maximumStateBytes: number;
}

function sourceRefs(state: RunContinuationState): Set<string> {
  return new Set(
    [
      ...state.verifiedFacts,
      ...state.hypotheses,
      ...state.completedActions,
    ].flatMap((entry) => entry.sourceRefs),
  );
}

function summaryOfInteraction(
  interaction: RunToolInteraction,
  excerptChars: number,
): string {
  const events: string[] = [];
  for (const message of interaction.messages) {
    if (message.role !== "assistant" || !("toolCalls" in message)) continue;
    message.toolCalls.forEach((call, index) => {
      const params = (() => {
        try {
          const parsed: unknown = JSON.parse(call.arguments);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            return "";
          const obj = parsed as Record<string, unknown>;
          return typeof obj.path === "string"
            ? ` (${obj.path.slice(0, 220)})`
            : "";
        } catch {
          return "";
        }
      })();
      const response = interaction.messages[index + 1];
      let status = "result unavailable";
      let detail = "";
      if (response?.role === "tool") {
        detail = response.content;
        try {
          const outer: unknown = JSON.parse(detail);
          if (outer && typeof outer === "object" && !Array.isArray(outer)) {
            const result = outer as Record<string, unknown>;
            status =
              typeof result.outcome === "string"
                ? result.outcome
                : typeof result.status === "string"
                  ? result.status
                  : "recorded";
            detail = typeof result.text === "string" ? result.text : detail;
            try {
              const inner: unknown = JSON.parse(detail);
              if (inner && typeof inner === "object" && !Array.isArray(inner)) {
                const data = inner as Record<string, unknown>;
                if (typeof data.content === "string") detail = data.content;
              }
            } catch {
              /* unstructured output remains evidence, not instructions */
            }
          } else status = "recorded";
        } catch {
          status = "recorded";
        }
      }
      // This is a record of observed output, never an assertion that an effect succeeded.
      const excerpt = excerptChars > 0 ? detail.slice(0, excerptChars) : "";
      events.push(
        `${call.name.slice(0, 100)}${params}: reported ${status}` +
          (excerpt ? `; output excerpt (untrusted): ${excerpt}` : "") +
          (detail.length > excerpt.length
            ? "; remaining output omitted; re-read source before relying on details"
            : ""),
      );
    });
  }
  return `Recorded tool round ${interaction.id}. Purpose: ${(interaction.purpose ?? "Unspecified").slice(0, 320)}. ${events.join(" | ") || "No tool-call detail available."}`;
}

function makeEntry(
  interaction: RunToolInteraction,
  existingIds: Set<string>,
  excerptChars: number,
): RunContinuationEntry {
  const prefix = `source_${interaction.id}`.slice(0, 170);
  let id = prefix;
  let suffix = 1;
  while (existingIds.has(id)) id = `${prefix}_${suffix++}`;
  existingIds.add(id);
  return {
    id,
    statement: summaryOfInteraction(interaction, excerptChars),
    sourceRefs: [interaction.id],
  };
}

function withCoverage(
  input: EvidenceInput,
  state: RunContinuationState,
  excerptChars: number,
): RunContinuationState {
  const verifiedFacts = [...state.verifiedFacts];
  const hypotheses = [...state.hypotheses];
  const completedActions = [...state.completedActions];
  const covered = sourceRefs(state);
  const ids = new Set(
    [...verifiedFacts, ...hypotheses, ...completedActions].map(
      (entry) => entry.id,
    ),
  );
  const previous = input.previous;
  for (const field of [
    "verifiedFacts",
    "hypotheses",
    "completedActions",
  ] as const) {
    if (!previous) break;
    const destination =
      field === "verifiedFacts"
        ? verifiedFacts
        : field === "hypotheses"
          ? hypotheses
          : completedActions;
    for (const entry of previous[field]) {
      if (
        entry.sourceRefs.some(
          (ref) => input.requiredSourceRefs.has(ref) && !covered.has(ref),
        )
      ) {
        if (!ids.has(entry.id)) {
          destination.push(entry);
          ids.add(entry.id);
          entry.sourceRefs.forEach((ref) => covered.add(ref));
        }
      }
    }
  }
  const bySource = new Map(
    input.interactions.map((interaction) => [interaction.id, interaction]),
  );
  for (const ref of input.requiredSourceRefs) {
    if (covered.has(ref)) continue;
    const interaction = bySource.get(ref);
    if (!interaction) {
      throw new ChatError(
        "invalid_response",
        `Required evidence ${ref} is neither in earlier verified state nor in persisted tool rounds.`,
      );
    }
    completedActions.push(makeEntry(interaction, ids, excerptChars));
    covered.add(ref);
  }
  return validateRunContinuationState(
    {
      version: RUN_CONTINUATION_STATE_VERSION,
      runId: input.runId,
      verifiedFacts,
      hypotheses,
      completedActions,
    },
    {
      runId: input.runId,
      validSourceRefs: input.validSourceRefs,
      requiredSourceRefs: input.requiredSourceRefs,
      maximumBytes: input.maximumStateBytes,
    },
  );
}

/**
 * Accept the model's findings only after strict shape/source validation. Fill
 * omitted source coverage from actual tool records, never from invented claims.
 */
export function validateReducerEvidenceProposal(
  proposal: unknown,
  input: EvidenceInput,
): RunContinuationState {
  const structurallyValidated = validateRunContinuationState(proposal, {
    runId: input.runId,
    validSourceRefs: input.validSourceRefs,
    requiredSourceRefs: new Set(),
    maximumBytes: input.maximumStateBytes,
  });
  for (const excerpt of [1000, 500, 200, 0]) {
    try {
      return withCoverage(input, structurallyValidated, excerpt);
    } catch (error) {
      if (
        !(error instanceof ChatError) ||
        error.code !== "invalid_response" ||
        !error.message.includes("serialized state exceeds")
      )
        throw error;
    }
  }
  throw new ChatError(
    "invalid_response",
    "Reducer proposal cannot fit its bounded state after evidence coverage.",
  );
}

/**
 * Last-resort projection using only durable prior findings and observed tool
 * responses. A tool result is reported as an observation, not re-executed.
 * Unsupported or unavailable evidence fails closed.
 */
export function fallbackReducerEvidence(
  input: EvidenceInput,
): RunContinuationState {
  const previous: RunContinuationState = input.previous ?? {
    version: RUN_CONTINUATION_STATE_VERSION,
    runId: input.runId,
    verifiedFacts: [],
    hypotheses: [],
    completedActions: [],
  };
  for (const excerpt of [1400, 800, 300, 80, 0]) {
    try {
      return withCoverage(input, previous, excerpt);
    } catch (error) {
      if (
        !(error instanceof ChatError) ||
        error.code !== "invalid_response" ||
        !error.message.includes("serialized state exceeds")
      )
        throw error;
    }
  }
  throw new ChatError(
    "invalid_response",
    "Even the minimal observed working-state ledger exceeds its byte budget.",
  );
}
