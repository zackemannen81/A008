import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import type { GuiModel } from "../session/session-controls.js";
import { modelCapabilityBadges } from "./parameters-panel.js";

const base: GuiModel = {
  id: "fixture/text",
  name: "Fixture",
  provider: "fixture",
  executionProvider: "nvidia",
  inputModalities: ["text"],
  verifiedOn: "2026-09-17",
  defaults: {
    stream: true,
    temperature: null,
    topP: null,
    maxTokens: 1024,
    enableThinking: null,
    reasoningBudget: null,
    reasoningEffort: null,
    seed: null,
    stop: null,
  },
  capabilities: {
    maxTokens: 1024,
    topP: false,
    thinking: false,
    reasoningBudget: null,
    reasoningEfforts: [],
    seed: false,
    stop: false,
    verifiedOn: "2026-09-17",
  },
};

test("model capability badges derive only from declared metadata", () => {
  assert.deepEqual(modelCapabilityBadges(base), []);
  assert.deepEqual(
    modelCapabilityBadges({ ...base, inputModalities: ["text", "image"] }),
    ["Vision", "Multimodal"],
  );
  assert.deepEqual(
    modelCapabilityBadges({
      ...base,
      capabilities: { ...base.capabilities, reasoningEfforts: ["high"] },
    }),
    ["Reasoning"],
  );
  assert.deepEqual(
    modelCapabilityBadges({ ...base, id: "looks-like-vision-model" }),
    [],
  );
});

test("Parameters owns the global parallel-session root without absorbing project lifecycle", () => {
  const source = readFileSync("./parameters-panel.tsx", "utf8");
  const panel = readFileSync("./workspace-sessions-panel.tsx", "utf8");
  assert.match(source, /Parallel sessions/u);
  assert.match(source, /WorkspaceSessionsPanel/u);
  assert.match(panel, /Worktree root/u);
  assert.match(panel, /saveWorkspaceSettings/u);
  assert.equal(panel.includes("createWorkspaceSession"), false);
  assert.equal(panel.includes("discardWorkspaceSession"), false);
});