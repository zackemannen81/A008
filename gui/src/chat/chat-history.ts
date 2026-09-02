import type { ChatTurn } from "./chat-transcript.js";

/**
 * The two display-only session buffers. `thought` is never folded into
 * `answer`; they travel as separate fields all the way to the DOM.
 */
export interface ChatLiveBuffers {
  readonly thought: string;
  readonly answer: string;
}

export interface ChatHistoryState {
  /** Committed turns only. The live turn is overlaid at render time. */
  readonly turns: readonly ChatTurn[];
  /** Most recent buffers observed on the session. */
  readonly observed: ChatLiveBuffers;
  /** Buffers already folded into `turns`, so a turn commits at most once. */
  readonly committed: ChatLiveBuffers;
  /** Stale buffers to keep out of the transcript until the session moves on. */
  readonly suppressed: ChatLiveBuffers | undefined;
  readonly nextId: number;
}

export type ChatHistoryEvent =
  | {
      readonly kind: "live";
      readonly thought: string;
      readonly answer: string;
    }
  | {
      readonly kind: "user";
      readonly text: string;
      readonly thought: string;
      readonly answer: string;
    };

const EMPTY_BUFFERS: ChatLiveBuffers = { thought: "", answer: "" };

export const initialChatHistory: ChatHistoryState = {
  turns: [],
  observed: EMPTY_BUFFERS,
  committed: EMPTY_BUFFERS,
  suppressed: undefined,
  nextId: 1,
};

function sameBuffers(left: ChatLiveBuffers, right: ChatLiveBuffers): boolean {
  return left.thought === right.thought && left.answer === right.answer;
}

function isEmpty(buffers: ChatLiveBuffers): boolean {
  return buffers.thought === "" && buffers.answer === "";
}

/**
 * Commit one assistant turn. `thought` stays on its own field; it is never
 * appended to `answer`.
 */
function foldAssistant(
  state: ChatHistoryState,
  live: ChatLiveBuffers,
): ChatHistoryState {
  if (isEmpty(live) || sameBuffers(state.committed, live)) {
    return state;
  }
  const turn: ChatTurn = {
    kind: "assistant",
    id: `a008-chat-assistant-${String(state.nextId)}`,
    thought: live.thought,
    answer: live.answer,
    live: false,
  };
  return {
    ...state,
    turns: [...state.turns, turn],
    committed: { thought: live.thought, answer: live.answer },
    nextId: state.nextId + 1,
  };
}

/**
 * Pure transcript state machine for `ChatPane`.
 *
 * `user` fires when the composer calls `session.prompt`; it commits whatever
 * assistant turn was still live and records the user text. `live` fires when
 * the session buffers change; a non-empty buffer that returns to empty commits
 * the finished assistant turn exactly once.
 */
export function reduceChatHistory(
  state: ChatHistoryState,
  event: ChatHistoryEvent,
): ChatHistoryState {
  const live: ChatLiveBuffers = {
    thought: event.thought,
    answer: event.answer,
  };

  if (event.kind === "user") {
    const folded = foldAssistant(state, live);
    const turn: ChatTurn = {
      kind: "user",
      id: `a008-chat-user-${String(folded.nextId)}`,
      text: event.text,
    };
    return {
      ...folded,
      turns: [...folded.turns, turn],
      nextId: folded.nextId + 1,
      observed: live,
      suppressed: live,
    };
  }

  if (sameBuffers(state.observed, live)) {
    return state;
  }

  if (isEmpty(live)) {
    const folded = foldAssistant(state, state.observed);
    return { ...folded, observed: live, suppressed: undefined };
  }

  const startingNewTurn = isEmpty(state.observed);
  const suppressed =
    state.suppressed !== undefined && sameBuffers(state.suppressed, live)
      ? state.suppressed
      : undefined;
  return {
    ...state,
    observed: live,
    committed: startingNewTurn ? EMPTY_BUFFERS : state.committed,
    suppressed,
  };
}

/** True while the transcript must ignore the current session buffers. */
export function shouldSuppressLive(
  state: ChatHistoryState,
  buffers: ChatLiveBuffers,
): boolean {
  return state.suppressed !== undefined && sameBuffers(state.suppressed, buffers);
}
