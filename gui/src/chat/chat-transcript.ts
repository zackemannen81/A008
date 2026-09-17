import type { GuiSession, RuntimeToolCall } from "../session/types.js";

export const CHAT_CHANNEL = {
  user: "user",
  thought: "thought",
  answer: "answer",
} as const;

export type ChatChannel = (typeof CHAT_CHANNEL)[keyof typeof CHAT_CHANNEL];

export interface ChatUserTurn {
  readonly kind: "user";
  readonly id: string;
  readonly text: string;
}

export type ChatToolActivity = RuntimeToolCall;

export interface ChatAssistantTurn {
  readonly kind: "assistant";
  readonly id: string;
  /** Display-only. Never concatenated into `answer`. */
  readonly thought: string;
  readonly answer: string;
  readonly live: boolean;
  readonly tools?: readonly ChatToolActivity[];
}

export type ChatTurn = ChatUserTurn | ChatAssistantTurn;

export interface ChatTranscript {
  readonly status: GuiSession["status"];
  readonly error: string | undefined;
  readonly empty: boolean;
  readonly turns: readonly ChatTurn[];
}

export interface ChatTranscriptInput {
  readonly session: GuiSession;
  /** Completed turns owned by ChatPane when the session has no `messages`. */
  readonly history?: readonly ChatTurn[];
  /**
   * When true, do not overlay `session.thought` / `session.answer`. Used after
   * a new user prompt until those buffers change.
   */
  readonly suppressLive?: boolean;
}

interface SessionMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

/**
 * Optional structural extension. The stub `GuiSession` has no `messages`
 * field; a later session client may add one without renaming stub exports.
 */
function readOptionalMessages(
  session: GuiSession,
): SessionMessage[] | undefined {
  const candidate = (session as GuiSession & { readonly messages?: unknown })
    .messages;
  if (candidate === undefined) {
    return undefined;
  }
  if (!Array.isArray(candidate)) {
    return [];
  }
  const messages: SessionMessage[] = [];
  for (const entry of candidate) {
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    const role = (entry as { readonly role?: unknown }).role;
    const content = (entry as { readonly content?: unknown }).content;
    if (
      (role === "user" || role === "assistant") &&
      typeof content === "string"
    ) {
      messages.push({ role, content });
    }
  }
  return messages;
}

function turnsFromMessages(messages: readonly SessionMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let userCount = 0;
  let assistantCount = 0;
  for (const message of messages) {
    if (message.role === "user") {
      userCount += 1;
      turns.push({
        kind: "user",
        id: `a008-chat-user-${String(userCount)}`,
        text: message.content,
      });
      continue;
    }
    assistantCount += 1;
    turns.push({
      kind: "assistant",
      id: `a008-chat-assistant-${String(assistantCount)}`,
      thought: "",
      answer: message.content,
      live: false,
    });
  }
  return turns;
}

function overlayLive(
  history: readonly ChatTurn[],
  thought: string,
  answer: string,
): ChatTurn[] {
  if (thought === "" && answer === "") {
    return history.map((turn) =>
      turn.kind === "assistant" ? { ...turn, live: false } : turn,
    );
  }

  const last = history.at(-1);
  if (last?.kind === "assistant") {
    const sameTurn =
      last.live ||
      last.answer === "" ||
      answer === last.answer ||
      (answer !== "" && answer.startsWith(last.answer));
    if (sameTurn) {
      return [
        ...history.slice(0, -1),
        {
          kind: "assistant",
          id: last.id,
          thought,
          answer: answer !== "" ? answer : last.answer,
          live: true,
          ...(last.tools !== undefined ? { tools: last.tools } : {}),
        },
      ];
    }
  }

  return [
    ...history,
    {
      kind: "assistant",
      id: "a008-chat-assistant-live",
      thought,
      answer,
      live: true,
    },
  ];
}

function attachLiveTools(
  turns: readonly ChatTurn[],
  tools: readonly ChatToolActivity[] | undefined,
): ChatTurn[] {
  if (tools === undefined || tools.length === 0) return [...turns];
  const copy = [...turns];
  const last = copy.at(-1);
  if (last?.kind === "assistant") {
    copy[copy.length - 1] = { ...last, tools };
    return copy;
  }
  copy.push({
    kind: "assistant",
    id: "a008-chat-assistant-tools",
    thought: "",
    answer: "",
    live: true,
    tools,
  });
  return copy;
}

/**
 * Build the A008 transcript. Thought is a separate display-only field and is
 * never concatenated into answer text.
 */
export function buildChatTranscript(
  input: ChatTranscriptInput,
): ChatTranscript {
  if (input.session.details !== undefined) {
    const session = input.session;
    const turns = turnsFromMessages(input.session.details.messages);
    if (session.pendingText !== undefined) {
      turns.push({
        kind: "user",
        id: "pending-user",
        text: session.pendingText,
      });
      turns.push({
        kind: "assistant",
        id: "pending-assistant",
        thought: session.thought,
        answer: session.answer,
        live: true,
      });
    } else {
      const last = turns.at(-1);
      if (last?.kind === "assistant" && last.answer === session.answer)
        turns[turns.length - 1] = { ...last, thought: session.thought };
    }
    const withTools = attachLiveTools(turns, session.tools);
    return {
      status: session.status,
      error: session.error,
      empty: withTools.length === 0,
      turns: withTools,
    };
  }
  const messages = readOptionalMessages(input.session);
  const history =
    messages !== undefined
      ? turnsFromMessages(messages)
      : (input.history ?? []);
  const thought = input.session.thought;
  const answer = input.session.answer;
  const turns =
    input.suppressLive === true
      ? history.map((turn) =>
          turn.kind === "assistant" ? { ...turn, live: false } : turn,
        )
      : overlayLive(history, thought, answer);
  const withTools = attachLiveTools(turns, input.session.tools);

  return {
    status: input.session.status,
    error: input.session.error,
    empty: withTools.length === 0,
    turns: withTools,
  };
}

/** Strings that ChatPane must put in each `data-a008-channel` node. */
export function channelTexts(turns: readonly ChatTurn[]): {
  readonly user: readonly string[];
  readonly thought: readonly string[];
  readonly answer: readonly string[];
} {
  const user: string[] = [];
  const thought: string[] = [];
  const answer: string[] = [];
  for (const turn of turns) {
    if (turn.kind === "user") {
      user.push(turn.text);
      continue;
    }
    if (turn.thought !== "") {
      thought.push(turn.thought);
    }
    if (turn.answer !== "") {
      answer.push(turn.answer);
    }
  }
  return { user, thought, answer };
}

/**
 * Empty-transcript copy. The `default` arm is unreachable for today's status
 * union and exists so a widened `GuiSession["status"]` from the session module
 * stays a compiling, rendering state instead of a build break.
 */
export function emptyStateCopy(status: GuiSession["status"]): string {
  switch (status) {
    case "idle":
      return "Connect to start a conversation with A008.";
    case "connecting":
      return "Connecting to A008…";
    case "error":
      return "A008 could not start this conversation.";
    case "ready":
      return "A008 is ready. Send a message to start.";
    default:
      return "A008 is ready when you are.";
  }
}
