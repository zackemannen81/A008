import type { ChatCompletion, ChatDelta } from "../../core/types.js";

export type NvidiaStreamChannel = "reasoning_content" | "content";

export interface NvidiaChannelTransition {
  readonly channel: NvidiaStreamChannel;
  readonly textLength: number;
}

const THINK_OPEN = /<think>|<thinking>|<\|begin_of_thinking\|>/iu;
const THINK_CLOSE = /<\/think>|<\/thinking>|<\|end_of_thinking\|>/iu;
const RESPONSE_MARKER = /I'll generate the response\.?\s*✅?\s*/iu;
const HOLD_AFTER_REASONING_CHARS = 80;

export function looksLikeChainOfThought(text: string): boolean {
  return /thinking process/iu.test(text) || RESPONSE_MARKER.test(text);
}

export function splitLeakedContent(content: string): {
  readonly reasoningLeak: string;
  readonly answer: string;
} {
  const tagged = splitThinkTags(content);
  if (tagged.closed) {
    return { reasoningLeak: tagged.reasoning, answer: tagged.content };
  }
  const marker = RESPONSE_MARKER.exec(content);
  if (marker !== null && marker.index !== undefined) {
    const end = marker.index + marker[0].length;
    return {
      reasoningLeak: content.slice(0, end),
      answer: content.slice(end).replace(/^\s+/u, ""),
    };
  }
  const check = content.lastIndexOf("✅");
  if (check >= 0) {
    const after = content.slice(check + "✅".length).replace(/^\s+/u, "");
    if (after.length > 0) {
      return {
        reasoningLeak: content.slice(0, check + "✅".length),
        answer: after,
      };
    }
  }
  if (looksLikeChainOfThought(content)) {
    return { reasoningLeak: content, answer: "" };
  }
  return { reasoningLeak: "", answer: content };
}

function splitThinkTags(content: string): {
  readonly closed: boolean;
  readonly reasoning: string;
  readonly content: string;
} {
  const open = THINK_OPEN.exec(content);
  const close = THINK_CLOSE.exec(content);
  if (open === null && close === null) {
    return { closed: false, reasoning: "", content };
  }
  if (close !== null && close.index !== undefined) {
    const end = close.index + close[0].length;
    return {
      closed: true,
      reasoning: content.slice(0, end),
      content: content.slice(end).replace(/^\s+/u, ""),
    };
  }
  return { closed: true, reasoning: content, content: "" };
}

export function verifiedFinalAnswer(completion: ChatCompletion): string {
  const reasoning = completion.reasoning ?? "";
  let content = completion.message.content;
  if (reasoning.length >= 8 && content.includes(reasoning)) {
    content = content.split(reasoning).join("");
  }
  const split = splitLeakedContent(content);
  if (split.reasoningLeak.length > 0 && looksLikeChainOfThought(content)) {
    content = split.answer;
  }
  return content.trim();
}

export function reasoningHasPathToText(
  reasoning: string,
  text: string,
): boolean {
  if (reasoning.length < 8 || text.length === 0) {
    return false;
  }
  return text.includes(reasoning);
}

export class NvidiaReasoningNormalizer {
  #reasoning = "";
  #content = "";
  #pending = "";
  #sawReasoningChannel = false;
  #answerStarted = false;
  #holdingForSplit = false;
  readonly #transitions: NvidiaChannelTransition[] = [];
  #lastChannel: NvidiaStreamChannel | undefined;

  push(channel: NvidiaStreamChannel, text: string): ChatDelta[] {
    if (text.length === 0) {
      return [];
    }
    if (this.#lastChannel !== channel) {
      this.#transitions.push({ channel, textLength: text.length });
      this.#lastChannel = channel;
    } else {
      const last = this.#transitions.at(-1);
      if (last !== undefined) {
        this.#transitions[this.#transitions.length - 1] = {
          channel,
          textLength: last.textLength + text.length,
        };
      }
    }
    if (channel === "reasoning_content") {
      this.#sawReasoningChannel = true;
      this.#reasoning += text;
      return [{ type: "reasoning", text }];
    }
    return this.#pushContent(text);
  }

  finish(): {
    readonly reasoning: string;
    readonly content: string;
    readonly transitions: readonly NvidiaChannelTransition[];
    readonly tailDeltas: readonly ChatDelta[];
  } {
    const tailDeltas = this.#flushPending();
    return {
      reasoning: this.#reasoning,
      content: this.#content,
      transitions: [...this.#transitions],
      tailDeltas,
    };
  }

  #pushContent(text: string): ChatDelta[] {
    if (this.#answerStarted && !this.#holdingForSplit) {
      this.#content += text;
      return [{ type: "content", text }];
    }
    if (!this.#sawReasoningChannel) {
      const tagged = splitThinkTags(text);
      if (tagged.reasoning.length > 0) {
        this.#reasoning += tagged.reasoning;
        const deltas: ChatDelta[] = [
          { type: "reasoning", text: tagged.reasoning },
        ];
        if (tagged.content.length > 0) {
          this.#content += tagged.content;
          this.#answerStarted = true;
          deltas.push({ type: "content", text: tagged.content });
        }
        return deltas;
      }
      this.#content += text;
      this.#answerStarted = true;
      return [{ type: "content", text }];
    }
    this.#pending += text;
    if (
      looksLikeChainOfThought(this.#pending) ||
      this.#pending.length >= HOLD_AFTER_REASONING_CHARS
    ) {
      this.#holdingForSplit = true;
      return [];
    }
    const emitted = this.#pending;
    this.#pending = "";
    this.#content += emitted;
    this.#answerStarted = true;
    return [{ type: "content", text: emitted }];
  }

  #flushPending(): ChatDelta[] {
    if (this.#pending.length === 0) {
      return [];
    }
    const split = splitLeakedContent(this.#pending);
    this.#pending = "";
    this.#holdingForSplit = false;
    const deltas: ChatDelta[] = [];
    if (split.reasoningLeak.length > 0) {
      this.#reasoning += split.reasoningLeak;
      deltas.push({ type: "reasoning", text: split.reasoningLeak });
    }
    if (split.answer.length > 0) {
      this.#content += split.answer;
      this.#answerStarted = true;
      deltas.push({ type: "content", text: split.answer });
    }
    return deltas;
  }
}
