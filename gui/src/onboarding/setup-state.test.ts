import assert from "node:assert/strict";
import test from "node:test";
import {
  composeSetupInstructions,
  readDefaultChatModel,
  readFirstRunSetupState,
  saveDefaultChatModel,
  saveFirstRunSetupState,
} from "./setup-state.js";

function store() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

test("first-run setup state uses safe defaults and preserves only local completion data", () => {
  const target = store();
  assert.equal(readFirstRunSetupState(target).completed, false);
  saveFirstRunSetupState({ completed: true, userName: "Rickard", customInstructions: "Be concise." }, target);
  assert.deepEqual(readFirstRunSetupState(target), { completed: true, userName: "Rickard", customInstructions: "Be concise." });
  saveDefaultChatModel("gpt-5.6-luna", target);
  assert.equal(readDefaultChatModel(target), "gpt-5.6-luna");
});

test("setup instructions compose identity and custom text without secrets", () => {
  assert.equal(composeSetupInstructions(" Rickard ", "Be concise."), "The user's name is Rickard. Address the user by this name when appropriate.\n\nBe concise.");
  assert.equal(composeSetupInstructions("", ""), "");
});
