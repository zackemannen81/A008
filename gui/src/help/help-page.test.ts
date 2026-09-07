import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GuiSession } from "../session/types.js";
import { HELP_SHORTCUTS, HelpPage } from "./help-page.js";

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

test("help page hosts the tool catalog and shortcut reference", () => {
  const html = renderToStaticMarkup(
    createElement(HelpPage, { session: session(), onChat() {} }),
  );
  assert.match(html, /aria-label="Help"/u);
  assert.match(html, /Tool catalog/u);
  assert.match(html, /Repository tools/u);
  assert.match(html, /Connect to load the host/u);
  assert.match(html, /tool catalog/u);
  for (const item of HELP_SHORTCUTS) {
    assert.ok(html.includes(item.action));
    assert.ok(html.includes(item.keys));
  }
});
