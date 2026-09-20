import assert from "node:assert/strict";
import { test } from "node:test";
import type { GuiSession } from "../session/types.js";
import type { SessionSnapshot } from "../session/session-controls.js";
import {
  buildChatTranscript,
  channelTexts,
  emptyStateCopy,
} from "./chat-transcript.js";

const THOUGHT_TOKEN = "SECRET_THOUGHT_TOKEN";
const ANSWER_TEXT = "Visible A008 answer.";

function fakeSession(overrides: Partial<GuiSession> = {}): GuiSession {
  return {
    status: "ready",
    sessionId: "session-1",
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    thought: "",
    answer: "",
    error: undefined,
    async connect() {},
    async prompt() {},
    async cancel() {},
    ...overrides,
  };
}

test("empty stub session yields an empty transcript", () => {
  const transcript = buildChatTranscript({ session: fakeSession() });
  assert.equal(transcript.empty, true);
  assert.deepEqual(channelTexts(transcript.turns), {
    user: [],
    thought: [],
    answer: [],
  });
  assert.equal(
    emptyStateCopy("ready"),
    "A008 is ready. Send a message to start.",
  );
});

test("thought and answer stay on separate channels", () => {
  const transcript = buildChatTranscript({
    session: fakeSession({ thought: THOUGHT_TOKEN, answer: ANSWER_TEXT }),
  });
  const channels = channelTexts(transcript.turns);
  assert.deepEqual(channels.thought, [THOUGHT_TOKEN]);
  assert.deepEqual(channels.answer, [ANSWER_TEXT]);
  assert.equal(channels.answer.join(""), ANSWER_TEXT);
  assert.equal(channels.answer.join("").includes(THOUGHT_TOKEN), false);
  const assistant = transcript.turns[0];
  assert.ok(assistant !== undefined && assistant.kind === "assistant");
  assert.equal(assistant.thought, THOUGHT_TOKEN);
  assert.equal(assistant.answer, ANSWER_TEXT);
  assert.equal(assistant.answer.includes(THOUGHT_TOKEN), false);
});

test("thought-only live turn does not invent answer text", () => {
  const transcript = buildChatTranscript({
    session: fakeSession({ thought: THOUGHT_TOKEN, answer: "" }),
  });
  const channels = channelTexts(transcript.turns);
  assert.deepEqual(channels.thought, [THOUGHT_TOKEN]);
  assert.deepEqual(channels.answer, []);
});

test("answer-only live turn does not invent thought text", () => {
  const transcript = buildChatTranscript({
    session: fakeSession({ thought: "", answer: ANSWER_TEXT }),
  });
  const channels = channelTexts(transcript.turns);
  assert.deepEqual(channels.thought, []);
  assert.deepEqual(channels.answer, [ANSWER_TEXT]);
});

test("overlay never concatenates thought into answer", () => {
  const transcript = buildChatTranscript({
    session: fakeSession({
      thought: THOUGHT_TOKEN,
      answer: ANSWER_TEXT,
    }),
    history: [
      {
        kind: "assistant",
        id: "prior",
        thought: "",
        answer: "Earlier answer.",
        live: false,
      },
    ],
  });
  const live = transcript.turns[1];
  assert.ok(live !== undefined && live.kind === "assistant");
  assert.equal(live.answer, ANSWER_TEXT);
  assert.equal(live.thought, THOUGHT_TOKEN);
  assert.notEqual(live.answer, `${THOUGHT_TOKEN}${ANSWER_TEXT}`);
  assert.notEqual(live.answer, `${ANSWER_TEXT}${THOUGHT_TOKEN}`);
  assert.equal(
    channelTexts(transcript.turns).answer.join("").includes(THOUGHT_TOKEN),
    false,
  );
});

test("streaming answer extends the same assistant turn", () => {
  const transcript = buildChatTranscript({
    session: fakeSession({ thought: THOUGHT_TOKEN, answer: "Hello, world." }),
    history: [
      {
        kind: "assistant",
        id: "stream",
        thought: THOUGHT_TOKEN,
        answer: "Hello",
        live: true,
      },
    ],
  });
  assert.equal(transcript.turns.length, 1);
  const assistant = transcript.turns[0];
  assert.ok(assistant !== undefined && assistant.kind === "assistant");
  assert.equal(assistant.id, "stream");
  assert.equal(assistant.answer, "Hello, world.");
  assert.equal(assistant.thought, THOUGHT_TOKEN);
  assert.equal(assistant.answer.includes(THOUGHT_TOKEN), false);
});

test("a new live turn does not rewrite a completed answer", () => {
  const transcript = buildChatTranscript({
    session: fakeSession({ thought: THOUGHT_TOKEN, answer: "Second answer." }),
    history: [
      {
        kind: "assistant",
        id: "first",
        thought: "",
        answer: "First answer.",
        live: false,
      },
    ],
  });
  assert.equal(transcript.turns.length, 2);
  const first = transcript.turns[0];
  const second = transcript.turns[1];
  assert.ok(first !== undefined && first.kind === "assistant");
  assert.ok(second !== undefined && second.kind === "assistant");
  assert.equal(first.answer, "First answer.");
  assert.equal(first.thought, "");
  assert.equal(second.answer, "Second answer.");
  assert.equal(second.thought, THOUGHT_TOKEN);
});

test("captured history keeps user text off the answer channel", () => {
  const transcript = buildChatTranscript({
    session: fakeSession({ thought: THOUGHT_TOKEN, answer: ANSWER_TEXT }),
    history: [{ kind: "user", id: "u1", text: "What is A008?" }],
  });
  const channels = channelTexts(transcript.turns);
  assert.deepEqual(channels.user, ["What is A008?"]);
  assert.deepEqual(channels.thought, [THOUGHT_TOKEN]);
  assert.deepEqual(channels.answer, [ANSWER_TEXT]);
  assert.equal(channels.user.join("").includes(THOUGHT_TOKEN), false);
});

test("optional session.messages supply user and assistant turns", () => {
  const session = fakeSession({ thought: THOUGHT_TOKEN, answer: ANSWER_TEXT });
  const withMessages = Object.assign(session, {
    messages: [
      { role: "user", content: "Hello A008" },
      { role: "assistant", content: ANSWER_TEXT },
    ],
  });
  const transcript = buildChatTranscript({ session: withMessages });
  const channels = channelTexts(transcript.turns);
  assert.deepEqual(channels.user, ["Hello A008"]);
  assert.deepEqual(channels.thought, [THOUGHT_TOKEN]);
  assert.deepEqual(channels.answer, [ANSWER_TEXT]);
  assert.equal(channels.answer.join("").includes(THOUGHT_TOKEN), false);
});

test("suppressLive hides current buffers after a new user prompt", () => {
  const transcript = buildChatTranscript({
    session: fakeSession({ thought: THOUGHT_TOKEN, answer: ANSWER_TEXT }),
    history: [{ kind: "user", id: "u2", text: "Next question" }],
    suppressLive: true,
  });
  const channels = channelTexts(transcript.turns);
  assert.deepEqual(channels.user, ["Next question"]);
  assert.deepEqual(channels.thought, []);
  assert.deepEqual(channels.answer, []);
});

test("snapshot image items keep request order across pending and completed states", () => {
  const locator = `source://${"ab".repeat(32)}/storm.png`;
  const details: SessionSnapshot = {
        model: "nvidia/nemotron-3.5-lightning-30b-a3b",
        parameters: {
          stream: true,
          temperature: null,
          topP: null,
          maxTokens: 1024,
          enableThinking: null,
          reasoningBudget: null,
          reasoningEffort: null,
          seed: null,
          stop: null,
        },
        messages: [
          { role: "user", content: "first" },
          {
            role: "assistant",
            content: [
              {
                type: "generated_image",
                generationId: "image-1",
                prompt: "lighthouse",
                status: "pending",
              },
            ],
          },
          { role: "user", content: "later text" },
          {
            role: "assistant",
            content: [
              {
                type: "generated_image",
                generationId: "image-2",
                prompt: "storm",
                status: "completed",
                locator,
                mediaType: "image/png",
                filename: "storm.png",
              },
            ],
          },
        ],
        runtime: { cwd: "C:/test", projectId: null, memoryPath: null },
  };
  const transcript = buildChatTranscript({
    session: fakeSession({ details }),
  });
  assert.deepEqual(
    transcript.turns.map((turn) => turn.kind),
    ["user", "image", "user", "image"],
  );
  assert.equal(transcript.turns[1]?.kind === "image" && transcript.turns[1].status, "pending");
  assert.equal(transcript.turns[3]?.kind === "image" && transcript.turns[3].id, "image-2");
});

test("error stays off thought and answer channels", () => {
  const transcript = buildChatTranscript({
    session: fakeSession({
      status: "error",
      error: "host unavailable",
      thought: THOUGHT_TOKEN,
      answer: ANSWER_TEXT,
    }),
  });
  assert.equal(transcript.error, "host unavailable");
  assert.equal(
    channelTexts(transcript.turns).answer.join("").includes("host unavailable"),
    false,
  );
  assert.equal(
    channelTexts(transcript.turns).answer.join("").includes(THOUGHT_TOKEN),
    false,
  );
});

test("empty-state copy survives a widened session status", () => {
  assert.equal(
    emptyStateCopy("idle"),
    "Connect to start a conversation with A008.",
  );
  // A008-0033 may add a status member; the pane must still render copy.
  const widened: string = "cancelled";
  assert.equal(
    emptyStateCopy(widened as GuiSession["status"]),
    "A008 is ready when you are.",
  );
});
