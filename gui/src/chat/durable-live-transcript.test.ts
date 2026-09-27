import assert from "node:assert/strict";
import { test } from "node:test";
import type { GuiSession } from "../session/types.js";
import type { SessionSnapshot } from "../session/session-controls.js";
import { buildChatTranscript, channelTexts } from "./chat-transcript.js";

const THOUGHT = "live reasoning";

function session(overrides: Partial<GuiSession>): GuiSession {
  return {
    status: "ready",
    sessionId: "durable-conversation",
    model: "gpt-5.6-luna",
    thought: "",
    answer: "",
    error: undefined,
    async connect() {},
    async prompt() {},
    async cancel() {},
    ...overrides,
  };
}

test("durable busy snapshot overlays thought and answer before completion", () => {
  const details = {
    model: "gpt-5.6-luna",
    parameters: {
      stream: true, temperature: null, topP: null, maxTokens: 1024,
      enableThinking: null, reasoningBudget: null, reasoningEffort: "medium",
      seed: null, stop: null,
    },
    messages: [{ role: "user", content: "status please" }],
  } as SessionSnapshot;
  const transcript = buildChatTranscript({
    session: session({
      details,
      busy: true,
      thought: THOUGHT,
      answer: "Streaming partial answer",
      pendingText: undefined,
    }),
  });
  const channels = channelTexts(transcript.turns);
  assert.deepEqual(channels.user, ["status please"]);
  assert.deepEqual(channels.thought, [THOUGHT]);
  assert.deepEqual(channels.answer, ["Streaming partial answer"]);
  const live = transcript.turns.at(-1);
  assert.ok(live?.kind === "assistant");
  assert.equal(live.live, true);
});
