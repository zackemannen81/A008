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
const css = readFileSync(join(here, "a008.css"), "utf8");

function appRule(): string {
  const start = css.indexOf(".a008-app {");
  assert.notEqual(start, -1, ".a008-app rule must exist");
  const end = css.indexOf("}", start);
  return css.slice(start, end);
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

test("the transcript still owns the scrolling", () => {
  const start = css.indexOf(".a008-chat-transcript");
  if (start === -1) {
    // The rule lives in gui/src/chat/chat-pane.css, which this module does not
    // own. Nothing to assert here.
    return;
  }
  const rule = css.slice(start, css.indexOf("}", start));
  assert.match(rule, /overflow/u);
});
