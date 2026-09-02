import assert from "node:assert/strict";
import { test } from "node:test";
import type { GuiSession } from "../session/types.js";
import { captureSessionPrompt } from "./capture-prompt.js";

function fakeSession(
  promptImpl?: (text: string) => Promise<void>,
): GuiSession & { readonly calls: string[] } {
  const calls: string[] = [];
  const session: GuiSession & { readonly calls: string[] } = {
    status: "ready",
    sessionId: undefined,
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    thought: "",
    answer: "",
    error: undefined,
    calls,
    async connect() {},
    async prompt(text) {
      calls.push(text);
      if (promptImpl !== undefined) {
        await promptImpl(text);
      }
    },
    async cancel() {},
  };
  return session;
}

test("captureSessionPrompt records non-empty user text and calls the original", async () => {
  const session = fakeSession();
  const captured: string[] = [];
  const restore = captureSessionPrompt(session, (text) => {
    captured.push(text);
  });
  await session.prompt("Hello from the composer");
  assert.deepEqual(captured, ["Hello from the composer"]);
  assert.deepEqual(session.calls, ["Hello from the composer"]);
  restore();
  await session.prompt("After restore");
  assert.deepEqual(captured, ["Hello from the composer"]);
  assert.deepEqual(session.calls, ["Hello from the composer", "After restore"]);
});

test("captureSessionPrompt ignores whitespace-only prompts", async () => {
  const session = fakeSession();
  const captured: string[] = [];
  const restore = captureSessionPrompt(session, (text) => {
    captured.push(text);
  });
  await session.prompt("   \n\t");
  assert.deepEqual(captured, []);
  assert.deepEqual(session.calls, ["   \n\t"]);
  restore();
});
