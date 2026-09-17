import assert from "node:assert/strict";
import test from "node:test";
import type { GuiSession } from "../session/types.js";
import {
  ComposerSlashError,
  parseSlash,
  SLASH_HELP,
} from "./slash.js";
import { submitComposer } from "./submit.js";
import type { SessionSnapshot } from "../session/session-controls.js";

const snapshot: SessionSnapshot = {
  model: "nvidia/nemotron-3.5-lightning-30b-a3b",
  parameters: { stream: true, temperature: 1, topP: .95, maxTokens: 16384, enableThinking: true, reasoningBudget: 4096, reasoningEffort: null, seed: null, stop: null },
  messages: [{ role: "user", content: "Committed question" }, { role: "assistant", content: "visible answer" }],
  runtime: { cwd: "C:/fixture", projectId: "fixture-project", memoryPath: "C:/fixture/memory.sqlite" },
};

test("parseSlash recognizes the A008-0029 command set and /! alias", () => {
  assert.deepEqual(parseSlash("  /help  "), { name: "help", argument: "" });
  assert.equal(parseSlash("/quit")?.name, "exit");
  assert.equal(parseSlash("/exit")?.name, "exit");
  assert.equal(parseSlash("/q")?.name, "exit");
  assert.equal(parseSlash("/clear")?.name, "reset");
  assert.equal(parseSlash("/reset")?.name, "reset");
  assert.deepEqual(parseSlash("/undo"), { name: "undo", argument: "" });
  assert.deepEqual(parseSlash("/history"), { name: "history", argument: "" });
  assert.deepEqual(parseSlash("/model"), { name: "model", argument: "" });
  assert.deepEqual(parseSlash("/model nvidia/example"), {
    name: "model",
    argument: "nvidia/example",
  });
  assert.deepEqual(parseSlash("/status"), { name: "status", argument: "" });
  assert.deepEqual(parseSlash("/cwd"), { name: "cwd", argument: "" });
  assert.deepEqual(parseSlash("/tools"), { name: "tools", argument: "" });
  assert.deepEqual(parseSlash("/shell npm test"), {
    name: "shell",
    argument: "npm test",
  });
  assert.deepEqual(parseSlash("/! npm test"), {
    name: "shell",
    argument: "npm test",
  });
  assert.equal(parseSlash("hello"), undefined);
  assert.equal(parseSlash("  hello /help"), undefined);
});

test("parseSlash rejects unknown /commands", () => {
  assert.throws(
    () => parseSlash("/foo"),
    (error: unknown) =>
      error instanceof ComposerSlashError &&
      error.code === "configuration" &&
      error.message === "Unknown command: /foo. Type /help.",
  );
  assert.throws(
    () => parseSlash("/langchain"),
    (error: unknown) =>
      error instanceof ComposerSlashError && error.code === "configuration",
  );
  assert.throws(
    () => parseSlash("/"),
    (error: unknown) =>
      error instanceof ComposerSlashError &&
      error.message === "Unknown command: /. Type /help.",
  );
});

test("submitComposer sends plain text as a prompt", async () => {
  const harness = createSessionHarness();
  const result = await submitComposer("  hello world  ", {
    session: harness.session,
    runShellCommand: unusedShell,
  });
  assert.deepEqual(result, { kind: "prompt", text: "hello world" });
  assert.deepEqual(harness.prompts, ["hello world"]);
  assert.deepEqual(harness.shells, []);
  assert.equal(harness.cancels, 0);
});

test("unknown slash command is an error, not a prompt", async () => {
  const harness = createSessionHarness();
  const result = await submitComposer("/foo", {
    session: harness.session,
    runShellCommand: unusedShell,
  });
  assert.deepEqual(result, {
    kind: "error",
    message: "Unknown command: /foo. Type /help.",
  });
  assert.deepEqual(harness.prompts, []);
  assert.deepEqual(harness.shells, []);
});

test("known slash commands are not sent as model prompts", async () => {
  const harness = createSessionHarness();
  const commands = [
    "/help",
    "/exit",
    "/quit",
    "/reset",
    "/clear",
    "/undo",
    "/history",
    "/model",
    "/status",
    "/cwd",
    "/tools",
  ];
  for (const command of commands) {
    const result = await submitComposer(command, {
      session: harness.session,
      runShellCommand: unusedShell,
      models: async () => [],
    });
    assert.equal(result.kind, "notice", command);
  }
  assert.deepEqual(harness.prompts, []);
  assert.deepEqual(harness.shells, []);
});

test("/help returns the composer command list", async () => {
  const harness = createSessionHarness();
  const result = await submitComposer("/help", {
    session: harness.session,
    runShellCommand: unusedShell,
  });
  assert.equal(result.kind, "notice");
  if (result.kind === "notice") {
    assert.equal(result.command, "help");
    assert.equal(result.message, SLASH_HELP);
    assert.match(result.message, /\/shell <command>/u);
    assert.match(result.message, /\/! <command>/u);
  }
});

test("/shell and /! call runShellCommand and never prompt", async () => {
  const harness = createSessionHarness();
  const first = await submitComposer("/shell npm test", {
    session: harness.session,
    runShellCommand: harness.runShellCommand,
  });
  const second = await submitComposer("/! echo hi", {
    session: harness.session,
    runShellCommand: harness.runShellCommand,
  });
  assert.deepEqual(first, {
    kind: "notice",
    command: "shell",
    message: "ran:npm test",
  });
  assert.deepEqual(second, {
    kind: "notice",
    command: "shell",
    message: "ran:echo hi",
  });
  assert.deepEqual(harness.shells, ["npm test", "echo hi"]);
  assert.deepEqual(harness.prompts, []);
});

test("/shell without a command is an error", async () => {
  const harness = createSessionHarness();
  const result = await submitComposer("/shell", {
    session: harness.session,
    runShellCommand: harness.runShellCommand,
  });
  assert.deepEqual(result, {
    kind: "error",
    message: "Usage: /shell <command>",
  });
  assert.deepEqual(harness.shells, []);
  assert.deepEqual(harness.prompts, []);
});

test("/shell consistently uses the native host runner", async () => {
  const harness = createSessionHarness();
  const sessionShells: string[] = [];
  const session = Object.assign(harness.session, {
    async shell(command: string): Promise<string> {
      sessionShells.push(command);
      return `session:${command}`;
    },
  });
  const result = await submitComposer("/shell pwd", {
    session,
    runShellCommand: harness.runShellCommand,
  });
  assert.deepEqual(result, {
    kind: "notice",
    command: "shell",
    message: "ran:pwd",
  });
  assert.deepEqual(sessionShells, []);
  assert.deepEqual(harness.shells, ["pwd"]);
  assert.deepEqual(harness.prompts, []);
});

test("/exit ends the session and does not prompt", async () => {
  const harness = createSessionHarness();
  const result = await submitComposer("/quit", {
    session: harness.session,
    runShellCommand: unusedShell,
  });
  assert.deepEqual(result, {
    kind: "notice",
    command: "exit",
    message: "Session ended. Connect to start a new conversation.",
  });
  assert.equal(harness.cancels, 1);
  assert.deepEqual(harness.prompts, []);
});

test("/history and /status inspect committed runtime state without reasoning", async () => {
  const harness = createSessionHarness({
    thought: "private reasoning",
    answer: "visible answer",
    sessionId: "sess-1",
    error: undefined,
  });
  const history = await submitComposer("/history", {
    session: harness.session,
    runShellCommand: unusedShell,
  });
  const status = await submitComposer("/status", {
    session: harness.session,
    runShellCommand: unusedShell,
  });
  assert.equal(history.kind, "notice");
  if (history.kind === "notice") {
    assert.equal(/thought|private reasoning/u.test(history.message), false);
    assert.match(history.message, /user: Committed question/u);
    assert.match(history.message, /assistant: visible answer/u);
  }
  assert.equal(status.kind, "notice");
  if (status.kind === "notice") {
    assert.match(status.message, /model: nvidia\/nemotron-3.5-lightning-30b-a3b/u);
    assert.match(status.message, /status: ready/u);
    assert.match(status.message, /session: sess-1/u);
    assert.match(status.message, /tools: terminal via \/shell/u);
    assert.match(status.message, /cwd: C:\/fixture/u);
    assert.match(status.message, /project: fixture-project/u);
    assert.match(status.message, /memory: C:\/fixture\/memory.sqlite/u);
  }
  assert.deepEqual(harness.prompts, []);
});

function createSessionHarness(
  overrides: Partial<GuiSession> = {},
): {
  readonly session: GuiSession;
  readonly prompts: string[];
  readonly shells: string[];
  readonly cancels: number;
  readonly runShellCommand: (command: string) => Promise<string>;
} {
  const prompts: string[] = [];
  const shells: string[] = [];
  const cancelCount = { value: 0 };
  const session: GuiSession = {
    status: "ready",
    sessionId: "sess-1",
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    thought: "",
    answer: "",
    error: undefined,
    async connect() {},
    async controlSession(control) { return { ...snapshot, ...(control.action === "undo" ? { undone: true } : {}) }; },
    async endSession() { cancelCount.value += 1; },
    async prompt(text: string) {
      prompts.push(text);
    },
    async cancel() {
      cancelCount.value += 1;
    },
    ...overrides,
  };
  return {
    session,
    prompts,
    shells,
    get cancels() {
      return cancelCount.value;
    },
    async runShellCommand(command: string) {
      shells.push(command);
      return `ran:${command}`;
    },
  };
}

async function unusedShell(): Promise<string> {
  throw new Error("runShellCommand must not be called");
}

test("submitComposer sends the transient image descriptor with an ordinary prompt", async () => {
  let captured: unknown;
  const harness = createSessionHarness();
  const session: GuiSession = {
    ...harness.session,
    async prompt(text, attachment) { captured = { text, attachment }; },
  };
  const attachment = { type: "image" as const, locator: `source:${"a".repeat(64)}/photo.png`, mediaType: "image/png" };
  const result = await submitComposer("describe it", { session, runShellCommand: unusedShell, attachment });
  assert.deepEqual(result, { kind: "prompt", text: "describe it" });
  assert.deepEqual(captured, { text: "describe it", attachment });
});
