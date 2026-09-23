import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { Readable } from "node:stream";
import { setImmediate as waitForImmediate } from "node:timers/promises";
import test from "node:test";
import { runCli } from "../src/cli.js";
import { DEFAULT_SYSTEM_MESSAGE } from "../src/core/chat-invocation.js";
import { RuntimePreferencesStore } from "../src/runtime/runtime-preferences-store.js";
import { MEMORY_CONTEXT_SYSTEM_INSTRUCTION } from "../src/orchestration/memory-prompt-composer.js";
import {
  captureStream,
  isolatedMemoryEnv,
  memoryAwareFakeTransport,
  semanticOperation,
} from "./helpers.js";

const ASSERTION = "Durable fact: the local memory project code is alpha-seven.";
const PROPOSITION = "the local memory project code is alpha-seven";

test("CLI two-turn chat commits a user assertion and projects it next turn", async () => {
  const stdout = captureStream();
  const stderr = captureStream();
  const isolated = isolatedMemoryEnv();
  const transport = memoryAwareFakeTransport({
    chat: (request, chatTurn) => ({
      content:
        chatTurn === 1
          ? "Noted."
          : "The local memory project code is alpha-seven.",
      reasoning: "PRIVATE_CLI_MEMORY",
    }),
    analyze: (input) => {
      const raw = input as { readonly userMessage?: unknown };
      return raw.userMessage === ASSERTION
        ? [
            {
              severity: "important",
              proposition: PROPOSITION,
              kind: "fact",
              tags: ["memory"],
              domains: ["runtime"],
              entities: ["alpha-seven"],
            },
          ]
        : [];
    },
    classify: () => ({ type: "new" }),
  });
  const stdin = Readable.from(
    (async function* () {
      yield `${ASSERTION}\n`;
      await waitForImmediate();
      yield "What is the local memory project code?\n";
      await waitForImmediate();
      yield "/exit\n";
    })(),
  );

  try {
    const code = await runCli(["chat"], {
      stdin,
      stdout: stdout.stream,
      stderr: stderr.stream,
      env: isolated.env,
      createTransport: () => transport,
    });
    const chatRequests = transport.requests.filter(
      (request) => semanticOperation(request) === undefined,
    );
    assert.equal(code, 0);
    assert.equal(chatRequests.length, 2);
    assert.match(
      chatRequests[1]?.messages.at(-1)?.content ?? "",
      new RegExp(PROPOSITION, "u"),
    );
    assert.equal(
      JSON.stringify(chatRequests[1]?.messages).includes("PRIVATE_CLI_MEMORY"),
      false,
    );
    assert.match(stdout.text(), /assistant> Noted\./u);
    assert.match(stdout.text(), /alpha-seven/u);
    assert.equal(stdout.text().includes("PRIVATE_CLI_MEMORY"), false);
    assert.match(stderr.text(), /reasoning> PRIVATE_CLI_MEMORY/u);
    assert.equal(stderr.text().includes("memory>"), false);
  } finally {
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("CLI keeps explicit --system distinct from fallback across model changes", async () => {
  for (const explicit of [undefined, DEFAULT_SYSTEM_MESSAGE]) {
    const isolated = isolatedMemoryEnv();
    const preferences = new RuntimePreferencesStore(isolated.env, 180000);
    const before = preferences.snapshot();
    preferences.save(
      { ...before.settings, instructions: "Global CLI instruction." },
      before.revision,
    );
    const transport = memoryAwareFakeTransport({
      chat: () => ({ content: "ok" }),
    });
    const stdin = Readable.from(
      (async function* () {
        yield "first question\n";
        await waitForImmediate();
        yield "/model meta/muse-glimmer-30b\n";
        await waitForImmediate();
        yield "second question\n";
        await waitForImmediate();
        yield "/exit\n";
      })(),
    );
    try {
      const stderr = captureStream();
      const code = await runCli(
        ["chat", ...(explicit === undefined ? [] : ["--system", explicit])],
        {
          stdin,
          stdout: captureStream().stream,
          stderr: stderr.stream,
          env: isolated.env,
          createTransport: () => transport,
        },
      );
      assert.equal(code, 0, stderr.text());
      const chat = transport.requests.filter(
        (r) => semanticOperation(r) === undefined,
      );
      assert.equal(chat.length, 2, stderr.text());
      assert.notEqual(chat[0]!.model, chat[1]!.model);
      for (const request of chat)
        assert.deepEqual(
          request.messages.filter((m) => m.role === "system"),
          [
            {
              role: "system",
              content: [
                ...(explicit === undefined ? [] : [explicit]),
                "Global CLI instruction.",
                MEMORY_CONTEXT_SYSTEM_INSTRUCTION,
              ].join("\n\n"),
            },
          ],
        );
    } finally {
      rmSync(isolated.directory, { recursive: true, force: true });
    }
  }
});
