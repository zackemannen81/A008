import assert from "node:assert/strict";
import test from "node:test";
import { ChatError } from "../src/core/errors.js";
import {
  formatTerminalResult,
  runTerminalCommand,
} from "../src/tools/terminal.js";

test("runTerminalCommand captures stdout from a local node process", async () => {
  const result = await runTerminalCommand({
    command: `node -e "process.stdout.write('ok')"`,
    cwd: process.cwd(),
    timeoutMs: 15_000,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.timedOut, false);
  assert.match(result.stdout, /ok/u);
});

test("runTerminalCommand rejects an empty command", async () => {
  await assert.rejects(
    () => runTerminalCommand({ command: "   ", cwd: process.cwd() }),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
});

test("formatTerminalResult includes exit and stdout", () => {
  const text = formatTerminalResult({
    command: "echo",
    cwd: "/tmp",
    exitCode: 0,
    signal: null,
    stdout: "hello\n",
    stderr: "",
    timedOut: false,
    truncated: false,
  });
  assert.match(text, /cwd: \/tmp/u);
  assert.match(text, /exit: 0/u);
  assert.match(text, /hello/u);
});
