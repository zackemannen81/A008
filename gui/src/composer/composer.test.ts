import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Composer } from "./composer.js";
import type { GuiSession } from "../session/types.js";

const session: GuiSession = {
  status: "idle",
  sessionId: undefined,
  model: "nvidia/nemotron-3.5-lightning-30b-a3b",
  thought: "",
  answer: "",
  error: undefined,
  async connect() {},
  async prompt() {},
  async cancel() {},
};

test("composer is a compact card with send action and session chips", () => {
  const html = renderToStaticMarkup(
    createElement(Composer, { session, onImage() {} }),
  );
  assert.match(html, /a008-composer-card/u);
  assert.match(html, /Ask anything, or describe a task/u);
  assert.match(html, />Send</u);
  assert.match(html, /aria-label="Add"/u);
  assert.match(html, /Choose image attachment/u);
  assert.match(html, /Attach image/u);
  assert.match(html, /Generate image/u);
  assert.match(html, /Commands/u);
  assert.match(html, /Enter to send/u);
});
