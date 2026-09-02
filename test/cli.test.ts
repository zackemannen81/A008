import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { Readable } from "node:stream";
import { setImmediate as waitForImmediate } from "node:timers/promises";
import test from "node:test";
import { runCli } from "../src/cli.js";
import type { ChatTransport } from "../src/core/types.js";
import {
  captureStream,
  isolatedMemoryEnv,
  memoryAwareFakeTransport,
  semanticOperation,
} from "./helpers.js";

function io() {
  const stdout = captureStream();
  const stderr = captureStream();
  return {
    stdout,
    stderr,
    deps: {
      stdin: Readable.from([]),
      stdout: stdout.stream,
      stderr: stderr.stream,
    },
  };
}

test("models works without credentials", async () => {
  const fixture = io();
  const code = await runCli(["models"], {
    ...fixture.deps,
    env: {},
  });

  assert.equal(code, 0);
  assert.match(fixture.stdout.text(), /nvidia\/nemotron-3\.5-lightning/u);
  assert.equal(fixture.stderr.text(), "");
});

test("help works without credentials", async () => {
  const fixture = io();
  const code = await runCli(["--help"], {
    ...fixture.deps,
    env: {},
  });

  assert.equal(code, 0);
  assert.match(fixture.stdout.text(), /NVIDIA_API_KEY/u);
  assert.match(fixture.stdout.text(), /A008_DEBUG_TRACE/u);
});

test("chat without a credential exits before creating a transport", async () => {
  const fixture = io();
  let transportCreations = 0;
  const unusedTransport: ChatTransport = {
    async complete() {
      throw new Error("must not be called");
    },
  };

  const code = await runCli(["chat"], {
    ...fixture.deps,
    env: {},
    createTransport: () => {
      transportCreations += 1;
      return unusedTransport;
    },
  });

  assert.equal(code, 2);
  assert.equal(transportCreations, 0);
  assert.match(fixture.stderr.text(), /NVIDIA_API_KEY is required/u);
});

test("interactive chat uses the injected shared transport", async () => {
  const fixture = io();
  const isolated = isolatedMemoryEnv();
  const transport = memoryAwareFakeTransport({
    chat: () => ({ content: "fake answer" }),
    analyze: () => [],
  });

  try {
    const code = await runCli(["chat"], {
      ...fixture.deps,
      stdin: Readable.from(["hello\n/exit\n"]),
      env: isolated.env,
      createTransport: () => transport,
    });

    assert.equal(code, 0);
    assert.equal(semanticOperation(transport.requests[0]!), undefined);
    assert.match(transport.requests[0]?.messages.at(-1)?.content ?? "", /hello/u);
    assert.equal(semanticOperation(transport.requests[1]!), "knowledge_analysis");
    assert.match(fixture.stdout.text(), /assistant> fake answer/u);
  } finally {
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("interactive reasoning is display-only and absent from the next request", async () => {
  const fixture = io();
  const isolated = isolatedMemoryEnv();
  const privateReasoning = "PRIVATE_CLI_REASONING";
  const transport = memoryAwareFakeTransport({
    chat: (_request, chatTurn) => ({
      content: `answer ${chatTurn}`,
      reasoning: privateReasoning,
    }),
    analyze: () => [],
  });

  const stdin = Readable.from(
    (async function* () {
      yield "first\n";
      await waitForImmediate();
      yield "second\n";
      await waitForImmediate();
      yield "/exit\n";
    })(),
  );

  try {
    const code = await runCli(["chat"], {
      ...fixture.deps,
      stdin,
      env: isolated.env,
      createTransport: () => transport,
    });

    const chatRequests = transport.requests.filter(
      (request) => semanticOperation(request) === undefined,
    );
    assert.equal(code, 0);
    assert.equal(chatRequests.length, 2);
    assert.match(fixture.stderr.text(), /reasoning> PRIVATE_CLI_REASONING/u);
    assert.equal(fixture.stdout.text().includes(privateReasoning), false);
    const second = JSON.stringify(chatRequests[1]?.messages ?? []);
    assert.equal(second.includes(privateReasoning), false);
    assert.match(second, /answer 1/u);
  } finally {
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});
