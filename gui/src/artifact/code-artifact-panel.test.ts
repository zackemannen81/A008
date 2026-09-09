import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CodeArtifactPanel } from "./code-artifact-panel.js";

const noop = () => undefined;

test("Code Canvas preview is a script-only sandbox with renderer-local source", () => {
  const html = renderToStaticMarkup(createElement(CodeArtifactPanel, {
    artifact: {
      sourceTurnId: "turn-1",
      source: "<canvas id=\"c\"></canvas><script>document.body.dataset.ok='1'</script>",
      modelSource: "<canvas id=\"c\"></canvas><script>document.body.dataset.ok='1'</script>",
      dirty: false,
    },
    onSourceChange: noop,
    onUseModelUpdate: noop,
    onRevert: noop,
    onClose: noop,
    onPrompt: noop,
  }));
  assert.match(html, /Code Canvas/u);
  assert.match(html, /sandbox="allow-scripts"/u);
  assert.equal(/allow-same-origin|allow-forms|allow-popups|allow-top-navigation/u.test(html), false);
  assert.match(html, /Content-Security-Policy/u);
  assert.match(html, /connect-src &#x27;none&#x27;/u);
  assert.equal(/NVIDIA_API_KEY|OPENAI_API_KEY|KIE_API_KEY/u.test(html), false);
});
