import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GuiSession } from "../session/types.js";
import { EnvironmentPanel } from "./environment-panel.js";

function session(): GuiSession {
  return {
    status: "idle",
    sessionId: undefined,
    model: "fixture",
    thought: "",
    answer: "",
    error: undefined,
    connect: async () => undefined,
    prompt: async () => undefined,
    cancel: async () => undefined,
  };
}

test("workbench card is environment and sources, not a tool catalog", () => {
  const html = renderToStaticMarkup(
    createElement(EnvironmentPanel, {
      session: session(),
      sources: [{ id: "source:1", name: "notes.md", kind: "upload" }],
      onSources() {},
      onChat() {},
      onShowAllSources() {},
    }),
  );
  assert.match(html, /aria-label="Workbench"/u);
  assert.match(html, /Environment/u);
  assert.match(html, /Sources/u);
  assert.match(html, /notes\.md/u);
  assert.match(html, /Pull request status is unavailable/u);
  assert.equal(html.includes("Model tools"), false);
  assert.equal(html.includes("exec_command"), false);
});
