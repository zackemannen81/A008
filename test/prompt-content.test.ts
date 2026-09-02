import assert from "node:assert/strict";
import test from "node:test";
import { RequestError } from "@agentclientprotocol/sdk";
import { promptToText } from "../src/acp/prompt-content.js";

test("ACP text and resource links become bounded chat text", () => {
  assert.equal(
    promptToText([
      { type: "text", text: "Review this" },
      {
        type: "resource_link",
        name: "spec",
        title: "Protocol spec",
        uri: "file:///workspace/spec.md",
        description: "Local design input",
      },
    ]),
    "Review this\n\n[Protocol spec](file:///workspace/spec.md)\nLocal design input",
  );
});

test("ACP prompt rejects content types the agent did not advertise", () => {
  assert.throws(
    () =>
      promptToText([
        {
          type: "image",
          data: "AA==",
          mimeType: "image/png",
        },
      ]),
    (error: unknown) => error instanceof RequestError && error.code === -32602,
  );
});

test("ACP prompt rejects empty text", () => {
  assert.throws(
    () => promptToText([{ type: "text", text: "  " }]),
    (error: unknown) => error instanceof RequestError && error.code === -32602,
  );
});
