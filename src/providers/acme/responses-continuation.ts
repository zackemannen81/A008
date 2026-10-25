import { AsyncLocalStorage } from "node:async_hooks";
import type { ChatRequest } from "../../core/types.js";

/** Scoped to one physical execution, including concurrent sessions/reducer calls. */
export const responsesExecution = new AsyncLocalStorage<{
  request: ChatRequest;
  output?: readonly Record<string, unknown>[];
}>();

/** Keep opaque reasoning and exact call items beside their matching outputs. */
export function responsesContinuationBody(body: string, request?: ChatRequest): string {
  if (!request) return body;
  const parsed = JSON.parse(body) as Record<string, unknown>;
  if (!Array.isArray(parsed.input)) return body;
  const byCall = new Map<string, { items: readonly Record<string, unknown>[]; first: boolean }>();
  for (const message of request.messages) {
    if (message.role !== "assistant" || !("toolCalls" in message) || !message.responseItems?.length) continue;
    const group = { items: message.responseItems, first: true };
    for (const call of message.toolCalls) byCall.set(call.id, group);
  }
  parsed.input = parsed.input.flatMap((item: Record<string, unknown>) => {
    if (item.type !== "function_call" || typeof item.call_id !== "string") return [item];
    const group = byCall.get(item.call_id);
    if (!group) return [item];
    const reasoning = group.first ? group.items.filter(entry => entry.type === "reasoning") : [];
    group.first = false;
    const original = group.items.find(entry => entry.type === "function_call" && entry.call_id === item.call_id);
    return [...reasoning, original ?? item];
  });
  parsed.store = false;
  parsed.include = [...new Set([...(Array.isArray(parsed.include) ? parsed.include : []), "reasoning.encrypted_content"])];
  return JSON.stringify(parsed);
}

/** Response output is execution state, never semantic memory or visible reasoning. */
export function captureResponsesOutput(text: string): void {
  const scope = responsesExecution.getStore();
  if (!scope) return;
  const parse = (value: string) => {
    try {
      const event = JSON.parse(value) as Record<string, unknown>;
      const response = (event.response ?? event) as Record<string, unknown>;
      if (Array.isArray(response.output)) scope.output = response.output.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null &&
          (item.type === "reasoning" || item.type === "function_call"),
      );
    } catch { /* Incomplete frames are buffered by the caller. */ }
  };
  if (text.trimStart().startsWith("{")) parse(text);
  else for (const frame of text.split(/\r?\n\r?\n/)) {
    const data = frame.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
    if (data && data !== "[DONE]") parse(data);
  }
}
