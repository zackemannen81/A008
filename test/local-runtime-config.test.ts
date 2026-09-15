import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ChatError } from "../src/core/errors.js";
import {
  ACME_MODEL_RUNTIME_URL_ENV,
  CHAT_MAX_TOKENS_ENV,
  CHAT_REASONING_BUDGET_ENV,
  CHAT_THINKING_ENV,
  CHAT_TOP_P_ENV,
  CHAT_TRANSPORT_ENV,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  PROVIDER_TIMEOUT_ENV,
  parseDebugTraceMode,
  parseLocalRuntimeConfig,
} from "../src/runtime/local-runtime-config.js";
import { TEST_PROJECT_ID } from "./helpers.js";

test("debug trace defaults to off and rejects unknown modes", () => {
  assert.equal(parseDebugTraceMode(undefined), "off");
  assert.equal(parseDebugTraceMode("SAFE"), "safe");
  assert.throws(
    () => parseDebugTraceMode("verbose"),
    (error: unknown) => error instanceof ChatError && error.code === "configuration",
  );
});

test("sqlite paths inside the repository are rejected", () => {
  assert.throws(
    () =>
      parseLocalRuntimeConfig(
        {
          A008_MEMORY_SQLITE_PATH: join(process.cwd(), "memory.sqlite"),
          A008_PROJECT_ID: TEST_PROJECT_ID,
        },
        { surface: "cli" },
      ),
    (error: unknown) =>
      error instanceof ChatError &&
      error.message.includes("outside the A008 repository"),
  );
});

test("raw tracing requires an absolute file and ACP tracing always does", () => {
  const directory = mkdtempSync(join(tmpdir(), "A008-config-"));
  const file = join(directory, "trace.debug.jsonl");
  assert.throws(
    () =>
      parseLocalRuntimeConfig(
        { A008_DEBUG_TRACE: "raw" },
        { surface: "cli" },
      ),
    (error: unknown) => error instanceof ChatError,
  );
  assert.throws(
    () =>
      parseLocalRuntimeConfig(
        { A008_DEBUG_TRACE: "safe" },
        { surface: "acp" },
      ),
    (error: unknown) => error instanceof ChatError,
  );
  const parsed = parseLocalRuntimeConfig(
    {
      A008_DEBUG_TRACE: "raw",
      A008_DEBUG_TRACE_FILE: file,
      A008_MEMORY_SQLITE_PATH: join(directory, "memory.sqlite"),
    },
    { surface: "cli" },
  );
  assert.equal(parsed.debugTrace, "raw");
  assert.equal(parsed.debugTraceFile, file);
});


function config(overrides: NodeJS.ProcessEnv = {}) {
  return parseLocalRuntimeConfig(
    { A008_PROJECT_ID: TEST_PROJECT_ID, ...overrides },
    { surface: "cli" },
  );
}

test("the provider timeout clears a long extraction and is configurable", () => {
  // The adapter's own fallback is 60s. An owner-observed run of this exact
  // workload took 87s in the provider playground and timed out here, so the
  // default must clear a long completeness extraction, not a short turn.
  assert.ok(DEFAULT_PROVIDER_TIMEOUT_MS > 87_000);
  assert.equal(config().providerTimeoutMs, DEFAULT_PROVIDER_TIMEOUT_MS);
  assert.equal(
    config({ [PROVIDER_TIMEOUT_ENV]: "240000" }).providerTimeoutMs,
    240_000,
  );

  for (const bad of ["0", "500", "abc", "-1", "1.5"]) {
    assert.throws(
      () => config({ [PROVIDER_TIMEOUT_ENV]: bad }),
      ChatError,
      `must reject ${bad}`,
    );
  }
});

test("chat generation options are overridable without editing the model profile", () => {
  // The profile ships reasoningBudget 16384 against maxTokens 16384, so
  // reasoning can consume the whole output budget and truncate the answer.
  assert.deepEqual(config().chatGeneration, {}, "no override unless asked");

  assert.deepEqual(
    config({
      [CHAT_REASONING_BUDGET_ENV]: "2048",
      [CHAT_MAX_TOKENS_ENV]: "32768",
      [CHAT_TOP_P_ENV]: "0.95",
      [CHAT_THINKING_ENV]: "off",
    }).chatGeneration,
    {
      topP: 0.95,
      maxTokens: 32_768,
      reasoningBudget: 2_048,
      enableThinking: false,
    },
  );

  assert.throws(() => config({ [CHAT_TOP_P_ENV]: "2" }), ChatError);
  assert.throws(() => config({ [CHAT_MAX_TOKENS_ENV]: "0" }), ChatError);
  assert.throws(() => config({ [CHAT_THINKING_ENV]: "maybe" }), ChatError);
});

test("ACME transport is explicit and requires an http(s) runtime URL", () => {
  assert.equal(config().chatTransport.mode, "direct");
  assert.throws(
    () => config({ [CHAT_TRANSPORT_ENV]: "fallback" }),
    ChatError,
  );
  assert.throws(
    () => config({ [CHAT_TRANSPORT_ENV]: "acme" }),
    (error: unknown) =>
      error instanceof ChatError &&
      error.message.includes(ACME_MODEL_RUNTIME_URL_ENV),
  );
  assert.throws(
    () =>
      config({
        [CHAT_TRANSPORT_ENV]: "acme",
        [ACME_MODEL_RUNTIME_URL_ENV]: "file:///tmp/acme",
      }),
    ChatError,
  );
  const parsed = config({
    [CHAT_TRANSPORT_ENV]: "acme",
    [ACME_MODEL_RUNTIME_URL_ENV]: "http://127.0.0.1:8787/",
  });
  assert.equal(parsed.chatTransport.mode, "acme");
  assert.equal(parsed.chatTransport.baseUrl, "http://127.0.0.1:8787");
});
