import type { RequestPermissionRequest, RequestPermissionResponse, SessionNotification } from "@agentclientprotocol/sdk";
import type { RuntimeBudgets } from "../core/runtime-preferences.js";
import type { ModelToolSession, ToolActivity } from "./model-tools.js";

export type RequestToolPermission = (params: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
export type ToolNotifier = (message: SessionNotification) => Promise<void>;

export function prepareAcpTools(tools: ModelToolSession, sessionId: string, budgets: RuntimeBudgets,
  signal: AbortSignal, notify: ToolNotifier, requestPermission?: RequestToolPermission) {
  const toolCall = (activity: ToolActivity) => ({ toolCallId: activity.id, title: activity.name,
    kind: activity.name === "exec_command" ? "execute" as const : "other" as const,
    status: activity.status,
    rawInput: { arguments: activity.input, cwd: activity.cwd },
    content: [{ type: "content" as const, content: { type: "text" as const,
      text: activity.output ?? `Working directory: ${activity.cwd}\n${activity.input}` } }],
  });
  return tools.prepare(budgets, {
    update: async activity => notify({ sessionId, update: {
      sessionUpdate: activity.status === "pending" ? "tool_call" : "tool_call_update", ...toolCall(activity),
    } }),
    approve: async activity => {
      if (!requestPermission) return false;
      let cancel: () => void = () => undefined;
      const cancelled = new Promise<never>((_, reject) => {
        cancel = () => reject(new DOMException("Tool approval cancelled", "AbortError"));
        signal.addEventListener("abort", cancel, { once: true });
        if (signal.aborted) cancel();
      });
      try {
        const response = await Promise.race([cancelled, requestPermission({ sessionId, toolCall: toolCall(activity), options: [
          { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
          { optionId: "reject-once", name: "Reject", kind: "reject_once" },
        ] })]);
        return response.outcome.outcome === "selected" && response.outcome.optionId === "allow-once";
      } catch {
        await notify({ sessionId, update: { sessionUpdate: "tool_call_update", ...toolCall({ ...activity, status: "failed", output: "Tool approval cancelled or unavailable. Nothing executed." }) } });
        signal.throwIfAborted();
        return false;
      } finally { signal.removeEventListener("abort", cancel); }
    },
  }, signal);
}
