import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isRuntimePreferencesSnapshot, type RuntimePreferencesSnapshot } from "./runtime-preferences.js";
import { GlobalSettingsForm } from "./global-settings-form.js";
import { parseSessionSnapshot, type SessionSnapshot } from "../session/session-controls.js";
import type { GuiSession } from "../session/types.js";

const preferences: RuntimePreferencesSnapshot = {
  revision: "fixture-revision",
  settings: { instructions: "<script>fixture</script>", budgets: { chatInputBytes: 65536 } },
  defaults: { instructions: "", budgets: { chatInputBytes: 131072 } },
  fields: [{ key: "chatInputBytes", label: "Chat input budget", unit: "UTF-8 bytes", description: "Synthetic description", minimum: 1, maximum: 1000000 }],
  storagePath: "C:/synthetic/settings.json",
};
const snapshot: SessionSnapshot = {
  model: "fixture", messages: [], runtime: { cwd: "fixture", projectId: null, memoryPath: null },
  parameters: { stream: true, temperature: null, topP: null, maxTokens: 8192, enableThinking: null, reasoningBudget: null, reasoningEffort: null, seed: null, stop: null },
  runtimePreferences: preferences,
};

test("global preferences accept additive snapshots and reject malformed metadata or saved budgets", () => {
  assert.equal(parseSessionSnapshot(snapshot).runtimePreferences, preferences);
  for (const p of [
    { ...preferences, settings: { ...preferences.settings, budgets: { chatInputBytes: "65536" } } },
    { ...preferences, fields: [...preferences.fields, ...preferences.fields] },
    { ...preferences, defaults: { instructions: false, budgets: { chatInputBytes: 65536 } } },
    { ...preferences, storagePath: 1 },
  ]) {
    assert.equal(isRuntimePreferencesSnapshot(p), false);
    assert.throws(() => parseSessionSnapshot({ ...snapshot, runtimePreferences: p }), /invalid session snapshot/);
  }
  const { runtimePreferences: _, ...old } = snapshot;
  assert.deepEqual(parseSessionSnapshot(old), old);
});

test("global editor escapes instructions, labels real units and keeps save disabled until changed", () => {
  const session: GuiSession = {
    status: "ready", sessionId: "fixture", model: "fixture", thought: "", answer: "", error: undefined,
    details: snapshot, connect: async () => {}, prompt: async () => {}, cancel: async () => {},
  };
  const html = renderToStaticMarkup(createElement(GlobalSettingsForm, { session, initial: preferences, page: "instructions" }));
  assert.ok(html.includes("&lt;script&gt;fixture&lt;/script&gt;"));
  assert.equal(html.includes("<script>"), false);
  assert.match(html, /type="submit" disabled=""/);
  assert.ok(html.includes("UTF-8 bytes"));
  assert.ok(html.includes("GLOBAL · ALL PROJECTS &amp; MODELS"));
  assert.ok(html.includes("Persistent instructions"));
  assert.match(html, /<section hidden="" aria-label="Runtime budgets"/);
});
