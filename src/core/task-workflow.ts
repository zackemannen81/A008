import { ChatError } from "./errors.js";
import type {
  RunContinuationState,
  RunToolInteraction,
} from "./chat-continuation.js";
import type {
  ChatRequest,
  ChatToolDefinition,
  ChatTransport,
  ChatWireMessage,
} from "./types.js";

export const WORKFLOW_PROGRESS_TOOL = "a008_update_workflow";
export const MAX_WORKFLOW_BYTES = 8192;

export interface TaskWorkflow {
  readonly description: string;
  readonly checklist: readonly {
    readonly id: string;
    readonly task: string;
    readonly done: boolean;
    readonly sourceRefs: readonly string[];
  }[];
  readonly nextAction: string;
}

export const workflowProgressTool: ChatToolDefinition = {
  name: WORKFLOW_PROGRESS_TOOL,
  description:
    "Update the run's persisted checklist and next action. Mark a step completed only with sourceRefs of observed successful tool rounds. This changes run status only, not project files. Use after completing a milestone, not after every read.",
  strict: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      completed: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            sourceRefs: { type: "array", items: { type: "string" } },
          },
          required: ["id", "sourceRefs"],
        },
      },
      nextAction: { type: "string" },
    },
    required: ["completed", "nextAction"],
  },
};

const workflowPlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    description: { type: "string" },
    checklist: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string" }, task: { type: "string" } },
        required: ["id", "task"],
      },
    },
    nextAction: { type: "string" },
  },
  required: ["description", "checklist", "nextAction"],
};

function cleanString(value: unknown, maximum: number): string | null {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum
    ? value.trim()
    : null;
}

export function validateTaskWorkflow(value: unknown): TaskWorkflow {
  if (typeof value !== "object" || !value || Array.isArray(value))
    throw new ChatError("invalid_response", "Invalid workflow checkpoint.");
  const data = value as Record<string, unknown>;
  const description = cleanString(data.description, 600);
  const nextAction = cleanString(data.nextAction, 320);
  if (
    !description ||
    !nextAction ||
    !Array.isArray(data.checklist) ||
    data.checklist.length < 1 ||
    data.checklist.length > 12
  )
    throw new ChatError(
      "invalid_response",
      "Invalid workflow description or checklist.",
    );
  const checklist: TaskWorkflow["checklist"][number][] = [];
  const seen = new Set<string>();
  for (const raw of data.checklist) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
      throw new ChatError("invalid_response", "Invalid workflow item.");
    const item = raw as Record<string, unknown>;
    const id = cleanString(item.id, 40);
    const task = cleanString(item.task, 180);
    if (
      !id ||
      !task ||
      seen.has(id) ||
      (item.done !== undefined && typeof item.done !== "boolean") ||
      (item.done === true &&
        (!Array.isArray(item.sourceRefs) || item.sourceRefs.length === 0)) ||
      (item.sourceRefs !== undefined &&
        (!Array.isArray(item.sourceRefs) ||
          item.sourceRefs.some(
            (ref) => typeof ref !== "string" || ref.length > 180,
          )))
    )
      throw new ChatError(
        "invalid_response",
        "Invalid workflow item or evidence.",
      );
    seen.add(id);
    checklist.push({
      id,
      task,
      done: item.done === true,
      sourceRefs: Array.isArray(item.sourceRefs) ? [...item.sourceRefs] : [],
    });
  }
  const result = { description, checklist, nextAction };
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_WORKFLOW_BYTES)
    throw new ChatError(
      "invalid_response",
      "Workflow checkpoint exceeds byte budget.",
    );
  return result;
}

export function fallbackTaskWorkflow(objective: string): TaskWorkflow {
  return validateTaskWorkflow({
    description: objective.slice(0, 600),
    checklist: [
      { id: "inspect", task: "Identify the necessary inputs and constraints" },
      {
        id: "implement",
        task: "Perform the requested work, preserving verified results",
      },
      { id: "verify", task: "Verify the result and report remaining work" },
    ],
    nextAction:
      "Inspect only the information needed to identify the first concrete action.",
  });
}

/** One bounded model call, with current retrieval already present in baseMessages. */
export async function prepareTaskWorkflow(input: {
  model: string;
  transport: ChatTransport;
  objective: string;
  baseMessages: readonly ChatWireMessage[];
  signal?: AbortSignal;
}): Promise<TaskWorkflow> {
  input.signal?.throwIfAborted();
  const context = input.baseMessages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const body = JSON.stringify({ objective: input.objective, context });
  const request: ChatRequest = {
    model: input.model,
    messages: [
      {
        role: "system",
        content:
          "Create an executable, compact task checklist grounded in the user's exact request and supplied context. These are tentative work steps, not permission to ignore source instructions. Do not claim any work completed. Specify the FIRST useful next action. Return strictly the JSON schema; no other text.",
      },
      {
        role: "user",
        content:
          body.length > 120_000
            ? JSON.stringify({
                objective: input.objective,
                context: context.slice(-3),
              })
            : body,
      },
    ],
    options: { stream: false, maxTokens: 1800 },
    outputSchema: { name: "a008_initial_workflow", schema: workflowPlanSchema },
    ...(input.signal ? { signal: input.signal } : {}),
  };
  try {
    const response = await input.transport.complete(request);
    input.signal?.throwIfAborted();
    const proposed: unknown = JSON.parse(response.message.content);
    return validateTaskWorkflow(proposed);
  } catch (error) {
    input.signal?.throwIfAborted();
    return fallbackTaskWorkflow(input.objective);
  }
}

function success(interaction: RunToolInteraction): boolean {
  const first = interaction.messages[0];
  if (!first || first.role !== "assistant" || !("toolCalls" in first))
    return false;
  return first.toolCalls.some((call, index) => {
    if (
      call.name === WORKFLOW_PROGRESS_TOOL ||
      call.name === "a008_select_tools"
    )
      return false;
    const result = interaction.messages[index + 1];
    if (result?.role !== "tool") return false;
    try {
      const obj: unknown = JSON.parse(result.content);
      if (typeof obj === "object" && obj !== null) {
        const record = obj as Record<string, unknown>;
        return record.failed !== true && record.status === "completed";
      }
    } catch {
      /* plain non-structured output cannot prove success */
    }
    return false;
  });
}

export function applyWorkflowProgress(
  existing: TaskWorkflow,
  input: unknown,
  interactions: readonly RunToolInteraction[],
): { workflow: TaskWorkflow; result: string } {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw Error("Invalid arguments.");
    const raw = input as Record<string, unknown>;
    const nextAction = cleanString(raw.nextAction, 320);
    if (
      !nextAction ||
      !Array.isArray(raw.completed) ||
      raw.completed.length > 12
    )
      throw Error("Expected completed milestones and a concrete next action.");
    const updates = new Map<string, readonly string[]>();
    for (const item of raw.completed) {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw Error("Invalid milestone.");
      const value = item as Record<string, unknown>;
      if (
        typeof value.id !== "string" ||
        updates.has(value.id) ||
        !Array.isArray(value.sourceRefs) ||
        value.sourceRefs.length < 1 ||
        value.sourceRefs.some(
          (ref) =>
            typeof ref !== "string" ||
            !interactions.some((round) => round.id === ref && success(round)),
        )
      )
        throw Error("Missing successful saved evidence for milestone.");
      updates.set(value.id, value.sourceRefs as string[]);
    }
    if (
      [...updates.keys()].some(
        (id) => !existing.checklist.some((step) => step.id === id),
      )
    )
      throw Error("Unknown checklist item.");
    const workflow = validateTaskWorkflow({
      ...existing,
      nextAction,
      checklist: existing.checklist.map((item) =>
        updates.has(item.id)
          ? {
              ...item,
              done: true,
              sourceRefs: [
                ...new Set([...item.sourceRefs, ...updates.get(item.id)!]),
              ],
            }
          : item,
      ),
    });
    return {
      workflow,
      result: JSON.stringify({
        status: "completed",
        updated: [...updates.keys()],
        nextAction,
      }),
    };
  } catch (error) {
    return {
      workflow: existing,
      result: JSON.stringify({
        status: "failed",
        error:
          error instanceof Error ? error.message : "Invalid workflow update",
      }),
    };
  }
}

function earliestSourceNumber(sourceRefs: readonly string[]): number {
  const n = sourceRefs
    .map((ref) => Number(ref.split(":").at(-1)))
    .filter(Number.isSafeInteger);
  return n.length ? Math.min(...n) : Number.MAX_SAFE_INTEGER;
}

/** Independent of earlier provider context; the sourceRefs identify exact durable evidence. */
export function renderTaskWorkflow(input: {
  objective: string;
  workflow: TaskWorkflow;
  state: RunContinuationState | null;
  recent: readonly RunToolInteraction[];
}): string {
  const { objective, workflow, state, recent } = input;
  const actions =
    state?.completedActions
      .map((entry) => ({
        ...entry,
        position: earliestSourceNumber(entry.sourceRefs),
      }))
      .sort((a, b) => a.position - b.position) ?? [];
  const recentRounds = recent.map((round) => ({
    sourceRef: round.id,
    purpose: round.purpose ?? null,
    tools:
      round.messages[0]?.role === "assistant" &&
      "toolCalls" in round.messages[0]
        ? round.messages[0].toolCalls.map((call) => ({
            name: call.name,
            arguments: call.arguments.slice(0, 420),
          }))
        : [],
    results: round.messages
      .slice(1)
      .filter((m) => m.role === "tool")
      .map((m) => m.content.slice(0, 700)),
  }));
  return JSON.stringify({
    kind: "a008_self_contained_working_document_v1",
    originalRequest: objective,
    taskDescription: workflow.description,
    checklist: workflow.checklist.map((item) => ({
      id: item.id,
      task: item.task,
      checked: item.done,
      evidence: item.sourceRefs,
    })),
    completedWorkChronological: actions.map((action) => ({
      order: action.position,
      sourceRefs: action.sourceRefs,
      findingOrResult: action.statement,
    })),
    verifiedFindings: state?.verifiedFacts ?? [],
    openHypotheses: state?.hypotheses ?? [],
    recentUnreducedToolRounds: recentRounds,
    nextAction: workflow.nextAction,
    continuationInstruction:
      "Continue from the next action and unchecked items. Earlier provider context is unavailable. Do not repeat completed reads or writes without a concrete need; check evidence and current state before any mutation.",
  });
}
