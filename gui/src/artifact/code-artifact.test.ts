import assert from "node:assert/strict";
import test from "node:test";
import {
  CODE_PREVIEW_SANDBOX,
  MAX_CODE_ARTIFACT_BYTES,
  buildPreviewDocument,
  htmlArtifactFromAnswer,
  parseAssistantAnswer,
} from "./code-artifact.js";

test("preview document stays free of host theme identity", () => {
  const preview = buildPreviewDocument("<p>hello</p>");
  assert.equal(preview.includes("data-a008-theme"), false);
  assert.equal(preview.includes("--a008-"), false);
  assert.equal(CODE_PREVIEW_SANDBOX, "allow-scripts");
});

test("assistant answer parser separates prose and complete fenced code", () => {
  const segments = parseAssistantAnswer(
    "Before\n```html\n<canvas id=\"c\"></canvas>\n```\nAfter",
  );
  assert.equal(segments.length, 3);
  assert.deepEqual(segments[0], { kind: "text", text: "Before\n" });
  assert.equal(segments[1]?.kind, "code");
  if (segments[1]?.kind === "code") {
    assert.equal(segments[1].language, "html");
    assert.equal(segments[1].artifactEligible, true);
    assert.match(segments[1].code, /canvas/u);
  }
  assert.deepEqual(segments[2], { kind: "text", text: "\nAfter" });
});

test("only complete bounded html fences become artifacts", () => {
  assert.equal(htmlArtifactFromAnswer("```html\n<div>", "turn-1"), undefined);
  assert.equal(htmlArtifactFromAnswer("```js\nconsole.log(1)\n```", "turn-2"), undefined);

  const artifact = htmlArtifactFromAnswer(
    "x\n```HTML title=demo\n<!doctype html><canvas></canvas>\n```",
    "turn-3",
  );
  assert.equal(artifact?.sourceTurnId, "turn-3");
  assert.equal(artifact?.language, "html");
  assert.match(artifact?.source ?? "", /canvas/u);

  const huge = "x".repeat(MAX_CODE_ARTIFACT_BYTES + 1);
  const segment = parseAssistantAnswer(`\`\`\`html\n${huge}\n\`\`\``)[0];
  assert.equal(segment?.kind, "code");
  if (segment?.kind === "code") {
    assert.equal(segment.artifactEligible, false);
    assert.equal(segment.oversized, true);
  }
});

test("preview document injects network-denying policy before untrusted html", () => {
  const preview = buildPreviewDocument(
    "<!doctype html><html><body><canvas></canvas><script>fetch('https://example.com')</script></body></html>",
  );
  assert.ok(preview.indexOf("Content-Security-Policy") < preview.indexOf("<html>"));
  assert.match(preview, /default-src 'none'/u);
  assert.match(preview, /connect-src 'none'/u);
  assert.match(preview, /form-action 'none'/u);
  assert.match(preview, /navigate-to 'none'/u);
  assert.match(preview, /preview network access is disabled/u);
  assert.equal(/allow-same-origin|allow-forms|allow-popups|allow-top-navigation/u.test(CODE_PREVIEW_SANDBOX), false);
  assert.equal(CODE_PREVIEW_SANDBOX, "allow-scripts");
  assert.throws(
    () => buildPreviewDocument("x".repeat(MAX_CODE_ARTIFACT_BYTES + 1)),
    /preview size limit/u,
  );
});
