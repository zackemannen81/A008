import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
} from "@agentclientprotocol/sdk";
import { ChatError } from "../core/errors.js";
import type { RuntimeBudgets } from "../core/runtime-preferences.js";
import type { RunContinuationCheckpointWrite, RunContinuationRecoveryBridge } from "../core/chat-continuation.js";
import type { ModelToolSession, ToolActivity } from "./model-tools.js";

export type ContinuationCheckpointWriter = (
  input: RunContinuationCheckpointWrite,
) => Promise<void>;

export type RequestToolPermission = (
  params: RequestPermissionRequest,
) => Promise<RequestPermissionResponse>;
export type ToolNotifier = (message: SessionNotification) => Promise<void>;

export async function prepareAcpTools(
  tools: ModelToolSession,
  sessionId: string,
  budgets: RuntimeBudgets,
  signal: AbortSignal,
  notify: ToolNotifier,
  requestPermission?: RequestToolPermission,
  writeContinuationCheckpoint?: ContinuationCheckpointWriter,
  recovery?: RunContinuationRecoveryBridge,
  executionObjective?: string,
  executionStateSeed?: import("../core/chat-continuation.js").RunExecutionStateSeed,
) {
  const toolCall = (activity: ToolActivity) => ({
    toolCallId: activity.id,
    title: activity.name,
    kind:
      activity.name === "exec_command"
        ? ("execute" as const)
        : ("other" as const),
    status: activity.status,
    rawInput: { arguments: activity.input, cwd: activity.cwd },
    content: [
      {
        type: "content" as const,
        content: {
          type: "text" as const,
          text:
            activity.output ??
            `Working directory: ${activity.cwd}\n${activity.input}`,
        },
      },
    ],
  });
  const prepared = await tools.prepare(
    budgets,
    {
      update: async (activity) =>
        notify({
          sessionId,
          update: {
            sessionUpdate:
              activity.status === "pending" ? "tool_call" : "tool_call_update",
            ...toolCall(activity),
          },
        }),
      approve: async (activity) => {
        if (!requestPermission) return false;
        let cancel: () => void = () => undefined;
        const cancelled = new Promise<never>((_, reject) => {
          cancel = () =>
            reject(new DOMException("Tool approval cancelled", "AbortError"));
          signal.addEventListener("abort", cancel, { once: true });
          if (signal.aborted) cancel();
        });
        try {
          const response = await Promise.race([
            cancelled,
            requestPermission({
              sessionId,
              toolCall: toolCall(activity),
              options: [
                {
                  optionId: "allow-once",
                  name: "Allow once",
                  kind: "allow_once",
                },
                {
                  optionId: "reject-once",
                  name: "Reject",
                  kind: "reject_once",
                },
              ],
            }),
          ]);
          return (
            response.outcome.outcome === "selected" &&
            response.outcome.optionId === "allow-once"
          );
        } catch {
          await notify({
            sessionId,
            update: {
              sessionUpdate: "tool_call_update",
              ...toolCall({
                ...activity,
                status: "failed",
                output:
                  "Tool approval cancelled or unavailable. Nothing executed.",
              }),
            },
          });
          signal.throwIfAborted();
          return false;
        } finally {
          signal.removeEventListener("abort", cancel);
        }
      },
    },
    signal,
  );
  const executionState = executionObjective === undefined
    ? undefined
    : {
        objective: executionObjective,
        seed: executionStateSeed ?? { current_phase: "execution" },
      };
  const pressure = budgets.continuationPressureBytes;
  const maximum = budgets.continuationMaximumBytes;
  if (pressure === 0 && maximum === 0) {
    if (recovery?.resume) throw new ChatError("configuration", "Continuation recovery requires enabled pressure policy.");
    return executionState ? { ...prepared, executionState } : prepared;
  }
  if (writeContinuationCheckpoint === undefined) {
    throw new ChatError(
      "configuration",
      "Automatic continuation is enabled but this runtime has no durable checkpoint owner.",
    );
  }
  return {
    ...prepared,
    continuation: {
      ...(recovery ? { recovery } : {}),
      recentRawInteractions: budgets.continuationRecentRawInteractions,
      maximumStateBytes: budgets.continuationStateBytes,
      pressure: {
        routeBudget: {
          pressureBytes: pressure,
          maximumBytes: maximum,
          reducerInputBytes: budgets.continuationReducerInputBytes,
          reducerOutputTokens: budgets.continuationReducerOutputTokens,
        },
        persistCheckpoint: writeContinuationCheckpoint,
      },
      compact: async () => {
        throw new ChatError(
          "configuration",
          "Pressure-managed continuation reduction is owned by the selected provider route.",
        );
      },
    },
  };
}
