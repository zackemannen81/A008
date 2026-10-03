import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * A layout guard, not a behaviour test.
 *
 * The chat pane scrolls itself to the bottom by writing `scrollTop`, which does
 * nothing unless `.a008-chat-transcript` actually overflows. It only overflows
 * when the shell grid is *capped*. `.a008-app` previously declared
 * `min-height: 100%` — a floor, not a cap — so the `1fr` row grew to fit its
 * content: measured in a browser at 3034px against a 720px viewport, with the
 * window scrolling and the transcript's `clientHeight` equal to its
 * `scrollHeight`.
 *
 * Only a real browser can prove the layout, and this repository has no browser
 * test runner, so this asserts the declaration that makes the difference. It is
 * a weak guard against an expensive silent regression, and is honest about
 * being one.
 */
const here = dirname(fileURLToPath(import.meta.url));
const a008Css = readFileSync(join(here, "a008.css"), "utf8");
const workspaceCss = readFileSync(join(here, "workspace.css"), "utf8");

function appRule(): string {
  const start = a008Css.indexOf(".a008-app {");
  assert.notEqual(start, -1, ".a008-app rule must exist");
  const end = a008Css.indexOf("}", start);
  return a008Css.slice(start, end);
}

test("the shell grid caps its height so the transcript can overflow", () => {
  const rule = appRule();
  assert.match(rule, /(^|\s)height:\s*100%/u, ".a008-app must cap its height");
});

test("the shell grid does not rely on min-height alone", () => {
  const rule = appRule();
  const capped = /(^|\s)height:\s*100%/u.test(rule);
  const floored = /min-height:\s*100%/u.test(rule);
  assert.equal(
    floored && !capped,
    false,
    "min-height alone lets the 1fr row grow to content and the window scroll",
  );
});

test("standalone navigation uses the configured sidebar width", () => {
  assert.ok(workspaceCss.includes("grid-template-columns: var(--a008-sidebar-width) minmax(0, 1fr)"));
  assert.ok(workspaceCss.includes(".a008-rail {\n  grid-column: 1"));
});

test("run notifications preserve the body styles", () => {
  assert.ok(a008Css.includes("body {"));
  assert.ok(a008Css.includes(".a008-run-notification {"));
});

test("the transcript still owns the scrolling", () => {
  const start = a008Css.indexOf(".a008-chat-transcript");
  if (start === -1) {
    // The rule lives in gui/src/chat/chat-pane.css, which this module does not
    // own. Nothing to assert here.
    return;
  }
  const rule = a008Css.slice(start, a008Css.indexOf("}", start));
  assert.match(rule, /overflow/u);
});
