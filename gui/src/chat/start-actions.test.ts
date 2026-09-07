import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { START_ACTIONS, StartActions } from "./start-actions.js";

test("start actions expose the four concept tasks", () => {
  const html = renderToStaticMarkup(
    createElement(StartActions, { onPrompt() {} }),
  );
  assert.equal(START_ACTIONS.length, 4);
  for (const action of START_ACTIONS) {
    assert.ok(html.includes(action.label));
  }
});
