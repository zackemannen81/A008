import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ChatError } from "../src/core/errors.js";
import {
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
          A007_MEMORY_SQLITE_PATH: join(process.cwd(), "memory.sqlite"),
          A007_PROJECT_ID: TEST_PROJECT_ID,
        },
        { surface: "cli" },
      ),
    (error: unknown) =>
      error instanceof ChatError &&
      error.message.includes("outside the a007 repository"),
  );
});

test("raw tracing requires an absolute file and ACP tracing always does", () => {
  const directory = mkdtempSync(join(tmpdir(), "a007-config-"));
  const file = join(directory, "trace.debug.jsonl");
  assert.throws(
    () =>
      parseLocalRuntimeConfig(
        { A007_DEBUG_TRACE: "raw" },
        { surface: "cli" },
      ),
    (error: unknown) => error instanceof ChatError,
  );
  assert.throws(
    () =>
      parseLocalRuntimeConfig(
        { A007_DEBUG_TRACE: "safe" },
        { surface: "acp" },
      ),
    (error: unknown) => error instanceof ChatError,
  );
  const parsed = parseLocalRuntimeConfig(
    {
      A007_DEBUG_TRACE: "raw",
      A007_DEBUG_TRACE_FILE: file,
      A007_MEMORY_SQLITE_PATH: join(directory, "memory.sqlite"),
    },
    { surface: "cli" },
  );
  assert.equal(parsed.debugTrace, "raw");
  assert.equal(parsed.debugTraceFile, file);
});
