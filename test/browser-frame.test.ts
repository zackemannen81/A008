import assert from "node:assert/strict";
import test from "node:test";
import { handleBrowserFrameCheck } from "../src/gui-host/browser-frame.js";
import { framePolicyFromHeaders } from "../src/gui-host/frame-policy.js";

const EMBEDDER = "http://127.0.0.1:8787";

test("chatgpt.com frame-ancestors does not allow the A008 host", () => {
  const headers = new Headers({
    "content-security-policy":
      "frame-ancestors 'self' chrome-extension://iaiigpefkbhgjcmcmffmfkpmhemdhdnj chrome-extension://lfkehkpjohcoelkpembgemeipeppanef",
  });
  const policy = framePolicyFromHeaders(headers, EMBEDDER, "https://chatgpt.com/");
  assert.equal(policy.embeddable, false);
  assert.equal(policy.reason, "frame-ancestors");
});

test("nvidia Build frame-ancestors does not allow the A008 host", () => {
  const headers = new Headers({
    "content-security-policy":
      "frame-ancestors 'self' *.nvidia.com *.hcaptcha.com hcaptcha.com",
  });
  const policy = framePolicyFromHeaders(headers, EMBEDDER, "https://build.nvidia.com/");
  assert.equal(policy.embeddable, false);
  assert.equal(policy.reason, "frame-ancestors");
});

test("report-only CSP does not block framing", () => {
  const headers = new Headers({
    "content-security-policy-report-only": "frame-ancestors 'none'",
  });
  assert.equal(framePolicyFromHeaders(headers, EMBEDDER, "https://example.test/").embeddable, true);
});

test("X-Frame-Options DENY blocks framing", () => {
  const headers = new Headers({ "x-frame-options": "DENY" });
  const policy = framePolicyFromHeaders(headers, EMBEDDER, "https://example.test/");
  assert.equal(policy.embeddable, false);
  assert.equal(policy.reason, "x-frame-options");
});

test("frame-ancestors * allows embedding", () => {
  const headers = new Headers({ "content-security-policy": "frame-ancestors *" });
  assert.equal(framePolicyFromHeaders(headers, EMBEDDER, "https://example.test/").embeddable, true);
});

test("missing framing headers are treated as embeddable", () => {
  assert.equal(framePolicyFromHeaders(new Headers(), EMBEDDER, "https://example.test/").embeddable, true);
});

test("frame-check uses response headers and cancels the body", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("<html>nope</html>"));
    },
    cancel() {
      cancelled = true;
    },
  });
  const result = await handleBrowserFrameCheck({
    url: "https://chatgpt.com/",
    embedderOrigin: EMBEDDER,
    fetch: async () =>
      new Response(stream, {
        headers: {
          "content-security-policy": "frame-ancestors 'self'",
        },
      }),
  });
  assert.equal(result.embeddable, false);
  assert.equal(result.reason, "frame-ancestors");
  assert.equal(cancelled, true);
});

test("frame-check tries the iframe when the probe cannot reach the site", async () => {
  const result = await handleBrowserFrameCheck({
    url: "https://example.test/",
    embedderOrigin: EMBEDDER,
    fetch: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(result.embeddable, true);
});

test("frame-check rejects non-http URLs", async () => {
  await assert.rejects(
    () =>
      handleBrowserFrameCheck({
        url: "file:///etc/passwd",
        embedderOrigin: EMBEDDER,
        fetch: async () => new Response(""),
      }),
    /http or https/u,
  );
});
