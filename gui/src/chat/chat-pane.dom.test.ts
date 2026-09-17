import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GuiSession } from "../session/types.js";
import { ChatPane } from "./chat-pane.js";
import { EMPTY_SHORTCUTS, EmptyShortcuts } from "./empty-shortcuts.js";

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

test("empty chat keeps start cards in the centre and does not host shortcut chips", () => {
  const html = renderToStaticMarkup(
    createElement(ChatPane, {
      session: fakeSession(),
      onStartPrompt() {},
    }),
  );
  assert.match(html, /What would you like to work on/u);
  assert.match(html, /Explore and understand the code/u);
  assert.match(html, /a008-empty-logo/u);
  assert.match(html, /a008-empty-rule/u);
  assert.match(html, /a008-starfield/u);
  assert.equal(html.includes("Workbench shortcuts"), false);
});

test("shortcut dock still lists every workbench action", () => {
  const html = renderToStaticMarkup(
    createElement(EmptyShortcuts, { onShortcut() {} }),
  );
  assert.match(html, /Workbench shortcuts/u);
  for (const item of EMPTY_SHORTCUTS) {
    assert.ok(html.includes(item.label), item.label);
    assert.ok(html.includes(item.keys), item.keys);
  }
});

test("empty chat without a shortcut handler keeps the previous hint", () => {
  const html = render(
    fakeSession({
      thought: "",
      answer: "",
      details: {
        model: "fixture",
        parameters: {
          stream: true,
          temperature: null,
          topP: null,
          maxTokens: 16,
          enableThinking: null,
          reasoningBudget: null,
          reasoningEffort: null,
          seed: null,
          stop: null,
        },
        messages: [],
        runtime: { cwd: "C:\\code\\A008", projectId: null, memoryPath: null },
      },
    }),
  );
  assert.match(html, /What would you like to work on/u);
  assert.match(html, /a008-empty-hint/u);
  assert.equal(html.includes("Workbench shortcuts"), false);
});

test("DOM contract: a thought-only turn renders no answer node", () => {
  const html = render(fakeSession({ thought: THOUGHT_TOKEN, answer: "" }));
  const nodes = channelNodes(html);
  assert.deepEqual(textsOn(nodes, "answer"), []);
  assert.equal(textsOn(nodes, "thought")[0]?.includes(THOUGHT_TOKEN), true);
  assert.equal(html.includes("Thinking"), true);
  assert.equal(html.includes("a008-starfield"), false);
});

test("DOM contract: the empty transcript shows A008 copy and no channels", () => {
  const html = render(fakeSession({ status: "ready" }));
  assert.deepEqual(channelNodes(html), []);
  assert.equal(html.includes("A008 is ready. Send a message to start."), true);
  assert.match(html, /a008-empty-logo/u);
  assert.match(html, /aria-hidden="true"/u);
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
  assert.equal(
    textsOn(nodes, "thought").join("").includes("host unavailable"),
    false,
  );
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

test("live tools attach only to the latest assistant turn", () => {
  const html = renderToStaticMarkup(
    createElement(ChatPane, {
      session: fakeSession({
        details: {
          model: "fixture",
          parameters: {
            stream: true,
            temperature: null,
            topP: null,
            maxTokens: 16,
            enableThinking: null,
            reasoningBudget: null,
            reasoningEffort: null,
            seed: null,
            stop: null,
          },
          messages: [
            { role: "user", content: "first" },
            { role: "assistant", content: "first answer" },
            { role: "user", content: "second" },
            { role: "assistant", content: "second answer" },
          ],
          runtime: { cwd: "C:\\code\\A008", projectId: null, memoryPath: null },
        },
        tools: [
          { id: "edit-2", title: "edit_file", status: "completed", text: "ok" },
        ],
      }),
    }),
  );
  const first = html.indexOf("first answer");
  const second = html.indexOf("second answer");
  const tool = html.indexOf("edit_file · completed");
  assert.ok(first >= 0 && second >= 0 && tool >= 0);
  assert.ok(tool > second, "current tools belong after the latest answer");
  assert.equal(html.includes("read_file"), false);
});

test("empty tool snapshot clears stale activity before the next prompt cycle", () => {
  const firstCycle = renderToStaticMarkup(
    createElement(ChatPane, {
      session: fakeSession({
        answer: "First answer",
        tools: [
          {
            id: "read-1",
            title: "read_file",
            status: "completed",
            text: "first",
          },
        ],
      }),
    }),
  );
  const resetCycle = renderToStaticMarkup(
    createElement(ChatPane, {
      session: fakeSession({ answer: "Second answer", tools: [] }),
    }),
  );
  assert.match(firstCycle, /read_file · completed/u);
  assert.equal(resetCycle.includes("read_file · completed"), false);
  assert.equal(resetCycle.includes("First answer"), false);
});

test("tool activity renders inside the assistant turn, not as a page footer", () => {
  const html = renderToStaticMarkup(
    createElement(ChatPane, {
      session: fakeSession({
        answer: "Saving index.html",
        tools: [
          { id: "read", title: "read_file", status: "completed", text: "ok" },
          { id: "edit", title: "edit_file", status: "completed", text: "ok" },
        ],
      }),
    }),
  );
  assert.match(html, /a008-tool-activity/u);
  assert.match(html, /read_file · completed/u);
  assert.match(html, /edit_file · completed/u);
  const assistant =
    /data-a008-role="assistant"[\s\S]*a008-tool-activity[\s\S]*<\/article>/u.exec(
      html,
    );
  assert.ok(assistant, "tool activity must sit inside the assistant article");
});

test("completed HTML code renders separately and exposes an explicit Canvas action", () => {
  const session = fakeSession({
    details: {
      model: "fixture",
      parameters: {
        stream: true,
        temperature: null,
        topP: null,
        maxTokens: 16,
        enableThinking: null,
        reasoningBudget: null,
        reasoningEffort: null,
        seed: null,
        stop: null,
      },
      messages: [
        { role: "user", content: "make a canvas" },
        {
          role: "assistant",
          content: 'Here\n```html\n<canvas id="demo"></canvas>\n```\nDone',
        },
      ],
      runtime: { cwd: "C:\\code\\A008", projectId: null, memoryPath: null },
    },
  });
  const html = renderToStaticMarkup(
    createElement(ChatPane, { session, onArtifactOpen() {} }),
  );
  assert.match(html, /a008-chat-code/u);
  assert.match(html, /Open in Canvas/u);
  assert.match(html, /a008-hl/u);
  assert.match(html, /hljs-(?:tag|name|attr)/u);
  assert.equal(html.includes("<canvas"), false);
  assert.match(html, /&lt;/u);
  const answers = textsOn(channelNodes(html), "answer");
  assert.equal(answers.length, 1);
  assert.equal(answers[0]?.includes("canvas"), true);
});

test("live or incomplete HTML never exposes the Canvas action", () => {
  const live = renderToStaticMarkup(
    createElement(ChatPane, {
      session: fakeSession({ answer: "```html\n<canvas></canvas>\n```" }),
      onArtifactOpen() {},
    }),
  );
  assert.equal(live.includes("Open in Canvas"), false);

  const incomplete = renderToStaticMarkup(
    createElement(ChatPane, {
      session: fakeSession({ answer: "```html\n<canvas></canvas>" }),
      onArtifactOpen() {},
    }),
  );
  assert.equal(incomplete.includes("Open in Canvas"), false);
});
