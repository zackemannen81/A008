import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { Readable } from "node:stream";
import { setImmediate as waitForImmediate } from "node:timers/promises";
import test from "node:test";
import { parseSlash } from "../src/cli/slash.js";
import { runCli } from "../src/cli.js";
import { ChatError } from "../src/core/errors.js";
import type { ChatTransport } from "../src/core/types.js";
import {
  captureStream,
  isolatedMemoryEnv,
  memoryAwareFakeTransport,
} from "./helpers.js";

test("parseSlash recognizes common commands and /! shell alias", () => {
  assert.deepEqual(parseSlash("  /help  "), { name: "help", argument: "" });
  assert.equal(parseSlash("/quit")?.name, "exit");
  assert.equal(parseSlash("/clear")?.name, "reset");
  assert.deepEqual(parseSlash("/shell npm test"), {
    name: "shell",
    argument: "npm test",
  });
  assert.deepEqual(parseSlash("/! npm test"), {
    name: "shell",
    argument: "npm test",
  });
  assert.equal(parseSlash("hello"), undefined);
});

test("parseSlash rejects unknown /commands", () => {
  assert.throws(
    () => parseSlash("/langchain"),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
});

test("interactive slash commands do not call the transport", async () => {
  const stdout = captureStream();
  const stderr = captureStream();
  const isolated = isolatedMemoryEnv();
  const transport = memoryAwareFakeTransport({
    chat: () => ({ content: "should-not-run" }),
    analyze: () => [],
  });
  const runs: string[] = [];

  try {
    const code = await runCli(["chat"], {
      stdin: Readable.from(
        (async function* () {
          for (const line of [
            "/help",
            "/status",
            "/cwd",
            "/tools",
            "/history",
            "/undo",
            "/shell npm test",
            "/reset",
            "/exit",
          ]) {
            yield `${line}\n`;
            await waitForImmediate();
          }
        })(),
      ),
      stdout: stdout.stream,
      stderr: stderr.stream,
      env: isolated.env,
      cwd: "C:\\code\\A008",
      runTerminal: async (input) => {
        runs.push(input.command);
        return {
          command: input.command,
          cwd: input.cwd,
          exitCode: 0,
          signal: null,
          stdout: "ok\n",
          stderr: "",
          timedOut: false,
          truncated: false,
        };
      },
      createTransport: () => transport,
    });

    assert.equal(code, 0);
    assert.equal(transport.requests.length, 0);
    assert.deepEqual(runs, ["npm test"]);
    const text = stdout.text();
    assert.match(text, /\/shell/u);
    assert.match(text, /cwd: C:\\code\\A008/u);
    assert.match(text, /tools: terminal via \/shell/u);
    assert.match(text, /native A008 runner/u);
    assert.match(text, /No conversation turns/u);
    assert.match(text, /Nothing to undo/u);
    assert.match(text, /shell> npm test/u);
    assert.match(text, /exit: 0/u);
    assert.match(text, /Session reset/u);
    assert.equal(text.includes("should-not-run"), false);
    assert.equal(stderr.text().includes("langchain"), false);
  } finally {
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("unknown slash command is not sent to the model", async () => {
  const stdout = captureStream();
  const stderr = captureStream();
  const isolated = isolatedMemoryEnv();
  const unused: ChatTransport = {
    async complete() {
      throw new Error("must not be called");
    },
  };

  try {
    const code = await runCli(["chat"], {
      stdin: Readable.from(["/langchain install\n", "/exit\n"]),
      stdout: stdout.stream,
      stderr: stderr.stream,
      env: isolated.env,
      createTransport: () => unused,
    });

    assert.equal(code, 0);
    assert.match(stderr.text(), /Unknown command: \/langchain/u);
  } finally {
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});
