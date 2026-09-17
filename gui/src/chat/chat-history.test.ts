import assert from "node:assert/strict";
import { test } from "node:test";
import {
  initialChatHistory,
  reduceChatHistory,
  shouldSuppressLive,
  type ChatHistoryEvent,
  type ChatHistoryState,
} from "./chat-history.js";
import { channelTexts } from "./chat-transcript.js";

const THOUGHT_TOKEN = "SECRET_THOUGHT_TOKEN";

function run(events: readonly ChatHistoryEvent[]): ChatHistoryState {
  let state = initialChatHistory;
  for (const event of events) {
    state = reduceChatHistory(state, event);
  }
  return state;
}

function live(thought: string, answer: string): ChatHistoryEvent {
  return { kind: "live", thought, answer };
}

function user(text: string, thought = "", answer = ""): ChatHistoryEvent {
  return { kind: "user", text, thought, answer };
}

test("a finished stream commits exactly one assistant turn", () => {
  const state = run([
    user("What is A008?"),
    live(THOUGHT_TOKEN, ""),
    live(THOUGHT_TOKEN, "A008 is"),
    live(THOUGHT_TOKEN, "A008 is one AI client."),
    live("", ""),
  ]);
  assert.equal(state.turns.length, 2);
  const channels = channelTexts(state.turns);
  assert.deepEqual(channels.user, ["What is A008?"]);
  assert.deepEqual(channels.answer, ["A008 is one AI client."]);
  assert.deepEqual(channels.thought, [THOUGHT_TOKEN]);
  assert.equal(channels.answer.join("").includes(THOUGHT_TOKEN), false);
});

test("a second prompt never duplicates the previous assistant turn", () => {
  const first = run([
    user("First question"),
    live(THOUGHT_TOKEN, "First answer."),
    live("", ""),
  ]);
  // The session client is free to clear the buffers before or after the next
  // prompt; neither ordering may commit "First answer." twice.
  const clearedFirst = run([
    user("First question"),
    live(THOUGHT_TOKEN, "First answer."),
    live("", ""),
    user("Second question"),
  ]);
  const promptedFirst = run([
    user("First question"),
    live(THOUGHT_TOKEN, "First answer."),
    user("Second question", THOUGHT_TOKEN, "First answer."),
    live("", ""),
  ]);
  assert.equal(first.turns.length, 2);
  assert.deepEqual(channelTexts(clearedFirst.turns).answer, ["First answer."]);
  assert.deepEqual(channelTexts(promptedFirst.turns).answer, ["First answer."]);
  assert.deepEqual(channelTexts(promptedFirst.turns).user, [
    "First question",
    "Second question",
  ]);
  assert.equal(promptedFirst.turns.length, 3);
});

test("two identical answers both commit", () => {
  const state = run([
    user("Say hi"),
    live("", "Hi."),
    live("", ""),
    user("Say hi"),
    live("", "Hi."),
    live("", ""),
  ]);
  assert.deepEqual(channelTexts(state.turns).answer, ["Hi.", "Hi."]);
  assert.equal(state.turns.length, 4);
});

test("repeated identical live events do not change state", () => {
  const first = run([live(THOUGHT_TOKEN, "Streaming")]);
  const second = reduceChatHistory(first, live(THOUGHT_TOKEN, "Streaming"));
  assert.equal(second, first);
});

test("committed turn ids are unique", () => {
  const state = run([
    user("One"),
    live("", "A."),
    live("", ""),
    user("Two"),
    live("", "B."),
    live("", ""),
  ]);
  const ids = state.turns.map((turn) => turn.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("stale buffers are suppressed until the session moves on", () => {
  const afterPrompt = run([
    live(THOUGHT_TOKEN, "Old answer."),
    user("Next question", THOUGHT_TOKEN, "Old answer."),
  ]);
  assert.equal(
    shouldSuppressLive(afterPrompt, {
      thought: THOUGHT_TOKEN,
      answer: "Old answer.",
    }),
    true,
  );
  const afterNewThought = reduceChatHistory(
    afterPrompt,
    live("New thought", ""),
  );
  assert.equal(
    shouldSuppressLive(afterNewThought, { thought: "New thought", answer: "" }),
    false,
  );
});

test("an interrupted thought-only turn still commits without an answer", () => {
  const state = run([user("Stop"), live(THOUGHT_TOKEN, ""), live("", "")]);
  const channels = channelTexts(state.turns);
  assert.deepEqual(channels.thought, [THOUGHT_TOKEN]);
  assert.deepEqual(channels.answer, []);
});

test("committed assistant turns keep thought off the answer field", () => {
  const state = run([
    user("Question"),
    live(THOUGHT_TOKEN, "Answer text."),
    live("", ""),
  ]);
  for (const turn of state.turns) {
    if (turn.kind === "assistant") {
      assert.equal(turn.answer.includes(THOUGHT_TOKEN), false);
      assert.equal(turn.answer, "Answer text.");
      assert.equal(turn.thought, THOUGHT_TOKEN);
    }
  }
});
