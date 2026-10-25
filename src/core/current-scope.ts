import type { ChatTextMessage } from "./types.js";

/** Bounded excerpts of two completed turns; never a claim of semantic summary. */
export function currentScope(messages: readonly ChatTextMessage[]): string {
  return JSON.stringify(messages.filter(m => m.role !== "system").slice(-4).map(m => ({
    role: m.role,
    text: m.content.length > 1000 ? `${m.content.slice(0, 1000)}… [excerpt]` : m.content,
  })));
}
