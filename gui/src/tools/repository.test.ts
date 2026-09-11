import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RepositoryPane, ToolActivity } from "./repository-pane.js";
import type { GuiSession } from "../session/types.js";

function session(overrides: Partial<GuiSession> = {}): GuiSession {
  return { status: "idle", sessionId: undefined, model: "fixture", thought: "", answer: "", error: undefined,
    connect: async () => undefined, prompt: async () => undefined, cancel: async () => undefined, ...overrides };
}
test("repository actions stay disabled without connected host tool metadata", () => {
  const html = renderToStaticMarkup(createElement(RepositoryPane, { session: session(), onChat() {} }));
  assert.match(html, /Connect to load/);
  assert.match(html, /disabled=""[^>]*>Read AGENTS/);
  assert.match(html, />Connect</);
  assert.equal(html.includes("exec_command"), false);
});
test("tool activity escapes arguments and distinguishes waiting, completed and failed calls", () => {
  const html = renderToStaticMarkup(createElement(ToolActivity, { tools: [
    { id: "read", title: "read_file", status: "completed", text: "<script>untrusted file</script>" },
    { id: "write", title: "edit_file", status: "pending", text: '{"old_text":"old","new_text":"new"}' },
    { id: "git", title: "git", status: "failed", text: "User denied execution." },
  ] }));
  assert.match(html, /awaiting approval/);
  assert.match(html, /read_file · completed/);
  assert.match(html, /git · failed/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(html.includes("<script>"), false);
});
