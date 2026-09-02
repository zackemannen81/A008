import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GuiSession } from "../session/types.js";
import { ChatPane } from "./chat-pane.js";

const THOUGHT_TOKEN = "SECRET_THOUGHT_TOKEN";
const ANSWER_TEXT = "A008 answers in the answer channel.";
const USER_TEXT = "What is A008?";

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

function render(session: GuiSession): string {
  return renderToStaticMarkup(createElement(ChatPane, { session }));
}

interface ChannelNode {
  readonly channel: string;
  readonly html: string;
  readonly text: string;
}

function decode(value: string): string {
  return value
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#x27;/gu, "'")
    .replace(/&amp;/gu, "&");
}

function stripTags(html: string): string {
  return decode(html.replace(/<[^>]*>/gu, ""));
}

/**
 * Collect every rendered element that carries `data-a008-channel`, with the
 * markup and the text actually inside it. This reads the DOM ChatPane emits,
 * not the transcript model it was built from.
 */
function channelNodes(html: string): readonly ChannelNode[] {
  const nodes: ChannelNode[] = [];
  const openTag = /<([a-zA-Z][\w-]*)\b([^>]*)>/gu;
  let opened: RegExpExecArray | null = openTag.exec(html);
  while (opened !== null) {
    const tag = opened[1] ?? "";
    const attributes = opened[2] ?? "";
    const channel = /data-a008-channel="([^"]*)"/u.exec(attributes)?.[1];
    if (channel !== undefined && tag !== "") {
      const start = opened.index + opened[0].length;
      const boundary = new RegExp(`</?${tag}\\b[^>]*>`, "gu");
      boundary.lastIndex = start;
      let depth = 1;
      let inner = html.slice(start);
      let edge: RegExpExecArray | null = boundary.exec(html);
      while (edge !== null) {
        depth += edge[0].startsWith("</") ? -1 : 1;
        if (depth === 0) {
          inner = html.slice(start, edge.index);
          break;
        }
        edge = boundary.exec(html);
      }
      nodes.push({ channel, html: inner, text: stripTags(inner) });
    }
    opened = openTag.exec(html);
  }
  return nodes;
}

function textsOn(nodes: readonly ChannelNode[], channel: string): string[] {
  return nodes
    .filter((node) => node.channel === channel)
    .map((node) => node.text);
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test("channelNodes reads a nested element back out of rendered markup", () => {
  const nodes = channelNodes(
    '<div data-a008-channel="thought"><span>a</span><span>b</span></div>' +
      '<p data-a008-channel="answer">c</p>',
  );
  assert.deepEqual(textsOn(nodes, "thought"), ["ab"]);
  assert.deepEqual(textsOn(nodes, "answer"), ["c"]);
});

test("DOM contract: thought text never lands on the answer channel", () => {
  const html = render(
    fakeSession({ thought: THOUGHT_TOKEN, answer: ANSWER_TEXT }),
  );
  const nodes = channelNodes(html);
  const answers = textsOn(nodes, "answer");
  const thoughts = textsOn(nodes, "thought");

  assert.deepEqual(answers, [ANSWER_TEXT]);
  assert.equal(answers.join("").includes(THOUGHT_TOKEN), false);
  assert.equal(thoughts.length, 1);
  assert.equal(thoughts[0]?.includes(THOUGHT_TOKEN), true);

  // The token exists in the document only inside the thought channel.
  const thoughtMarkup = nodes
    .filter((node) => node.channel === "thought")
    .map((node) => node.html)
    .join("");
  assert.equal(
    occurrences(html, THOUGHT_TOKEN),
    occurrences(thoughtMarkup, THOUGHT_TOKEN),
  );
  assert.equal(occurrences(html, THOUGHT_TOKEN), 1);
});

test("DOM contract: committed answers stay free of the live thought", () => {
  const session = Object.assign(
    fakeSession({ thought: THOUGHT_TOKEN, answer: ANSWER_TEXT }),
    {
      messages: [
        { role: "user", content: USER_TEXT },
        { role: "assistant", content: "Committed answer." },
      ],
    },
  );
  const html = render(session);
  const nodes = channelNodes(html);

  assert.deepEqual(textsOn(nodes, "user"), [USER_TEXT]);
  assert.deepEqual(textsOn(nodes, "answer"), [
    "Committed answer.",
    ANSWER_TEXT,
  ]);
  assert.equal(
    textsOn(nodes, "answer").join("").includes(THOUGHT_TOKEN),
    false,
  );
  assert.equal(textsOn(nodes, "user").join("").includes(THOUGHT_TOKEN), false);
  assert.equal(occurrences(html, THOUGHT_TOKEN), 1);
});

test("DOM contract: a thought-only turn renders no answer node", () => {
  const html = render(fakeSession({ thought: THOUGHT_TOKEN, answer: "" }));
  const nodes = channelNodes(html);
  assert.deepEqual(textsOn(nodes, "answer"), []);
  assert.equal(textsOn(nodes, "thought")[0]?.includes(THOUGHT_TOKEN), true);
  assert.equal(html.includes("Thinking"), true);
});

test("DOM contract: the empty transcript shows A008 copy and no channels", () => {
  const html = render(fakeSession({ status: "ready" }));
  assert.deepEqual(channelNodes(html), []);
  assert.equal(html.includes("A008 is ready. Send a message to start."), true);
});

test("DOM contract: session error renders outside the answer channel", () => {
  const html = render(
    fakeSession({
      status: "error",
      error: "host unavailable",
      thought: THOUGHT_TOKEN,
      answer: ANSWER_TEXT,
    }),
  );
  const nodes = channelNodes(html);
  assert.equal(html.includes("host unavailable"), true);
  assert.equal(
    textsOn(nodes, "answer").join("").includes("host unavailable"),
    false,
  );
  assert.equal(textsOn(nodes, "thought").join("").includes("host unavailable"), false);
});

test("DOM contract: rendered markup carries A008 copy and no OpenHands identity", () => {
  const html = render(
    fakeSession({ thought: THOUGHT_TOKEN, answer: ANSWER_TEXT }),
  );
  assert.equal(html.includes("A008 chat"), true);
  assert.equal(/openhands/iu.test(html), false);
  assert.equal(/agent server/iu.test(html), false);
  assert.equal(/posthog/iu.test(html), false);
});
