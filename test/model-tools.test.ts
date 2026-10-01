import assert from "node:assert/strict";
import {
  activeMcpServers,
  parseUserCatalog,
} from "../src/core/user-catalog.js";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  existsSync,
  rmSync,
  writeFileSync,
  symlinkSync,
  truncateSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ChatSession } from "../src/core/chat-session.js";
import { NvidiaChatTransport } from "../src/providers/nvidia/nvidia-chat-transport.js";
import {
  ModelToolSession,
  boundedToolText,
  normalizeOptionalNullArguments,
  toolEnvironment,
  type ToolActivity,
} from "../src/tools/model-tools.js";
import {
  atomicAdoptText,
  EDIT_FAILURE_OUTPUT_BYTES,
} from "../src/tools/file-edit-engine.js";
import {
  bindRuntimeMcpArguments,
  presentMcpSchema,
  probeStdioMcpServer,
} from "../src/tools/mcp-runtime.js";
import { DEFAULT_RUNTIME_BUDGETS as budgets } from "../src/core/runtime-preferences.js";
import { RuntimePreferencesStore } from "../src/runtime/runtime-preferences-store.js";
import { runTerminalCommand } from "../src/tools/terminal.js";
import { prepareAcpTools } from "../src/tools/acp-tools.js";
import { isolatedMemoryEnv } from "./helpers.js";
import { startGuiHost } from "../src/gui-host/server.js";
import { startSessionControlProvider } from "./fixtures/session-control-provider.js";
import { WireClient } from "./fixtures/gui-wire-client.js";
import { EmbeddedAcmeChatTransport } from "../src/providers/acme/embedded-acme-chat-transport.js";

test("native sectional tool schemas reach ACME OpenAI strict serialization with optional ranges", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-native-wire-"));
  const tools = new ModelToolSession({ cwd, env: {} });
  try {
    const port = await tools.prepare(
      budgets,
      { approve: async () => true, update: async () => undefined },
      new AbortController().signal,
    );
    let wire: any;
    const transport = new EmbeddedAcmeChatTransport({
      env: { OPENAI_API_KEY: "sk-fixture" },
      catalogPath: join(cwd, "catalog.json"),
      requestKey: () => "native-tools-fixture",
      fetch: async (_input, init) => {
        wire = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            id: "resp_native_tools",
            model: "gpt-5.6-luna",
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "OK" }],
              },
            ],
            usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });
    await transport.complete({
      model: "gpt-5.6-luna",
      messages: [{ role: "user", content: "Inspect a section." }],
      tools: port.definitions,
      options: { stream: false },
    });
    assert.equal(wire.tools.length, port.definitions.length);
    for (const tool of wire.tools) {
      assert.equal(tool.strict, true);
      assert.equal(tool.parameters.additionalProperties, false);
      assert.deepEqual(
        [...tool.parameters.required].sort(),
        Object.keys(tool.parameters.properties).sort(),
      );
    }
    const read = wire.tools.find((tool: any) => tool.name === "read_file");
    assert.match(JSON.stringify(read.parameters.properties.offset), /null/);
    assert.match(JSON.stringify(read.parameters.properties.limit), /null/);
    assert.match(
      JSON.stringify(read.parameters.properties.max_output_bytes),
      /null/,
    );
  } finally {
    await tools.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("sectional read/edit keeps large files out of context and chains whole-file revisions", async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-tool-context-"));
  const tools = new ModelToolSession({ cwd, env: process.env });
  try {
    const port = await tools.prepare(
      { ...budgets, toolOutputBytes: 4096 },
      { approve: async () => true, update: async () => undefined },
      new AbortController().signal,
    );
    let id = 0;
    const execute = async (name: string, args: unknown) =>
      JSON.parse(
        await port.execute({
          id: String(++id),
          name,
          arguments: JSON.stringify(args),
        }),
      );
    const content = Array.from(
      { length: 10000 },
      (_, i) => `line ${i}: å🙂 value\r\n`,
    ).join("");
    writeFileSync(join(cwd, "large.txt"), content);
    const read = await execute("read_file", {
      path: "large.txt",
      offset: 5000,
      limit: 3,
    });
    assert.equal(read.status, "completed");
    assert.equal(read.truncated, false);
    const page = JSON.parse(read.text);
    assert.equal(
      page.content,
      content
        .split(/(?<=\n)/)
        .slice(5000, 5003)
        .join(""),
    );
    assert.equal(
      page.sha256,
      createHash("sha256").update(content).digest("hex"),
    );
    assert.equal(page.total_lines, 10000);
    assert.equal(page.next_offset, 5003);
    assert.equal(page.complete, false);
    const edited = await execute("edit_file", {
      path: "large.txt",
      expected_sha256: page.sha256,
      old_text: "line 5000: å🙂 value\nline 5001: å🙂 value\n",
      new_text: "line 5000: changed\nline 5001: changed\n",
    });
    assert.equal(edited.status, "completed");
    const revision = JSON.parse(edited.text).sha256;
    const chained = await execute("edit_file", {
      path: "large.txt",
      expected_sha256: revision,
      old_text: "line 5002: å🙂 value",
      new_text: "line 5002: changed",
    });
    assert.equal(chained.status, "completed");
    const disk = readFileSync(join(cwd, "large.txt"), "utf8");
    assert.equal(
      disk,
      content
        .replace("line 5000: å🙂 value", "line 5000: changed")
        .replace("line 5001: å🙂 value", "line 5001: changed")
        .replace("line 5002: å🙂 value", "line 5002: changed"),
    );
    assert.equal(
      JSON.parse(chained.text).sha256,
      createHash("sha256").update(disk).digest("hex"),
    );
    const stale = await execute("edit_file", {
      path: "large.txt",
      expected_sha256: page.sha256,
      old_text: "changed",
      new_text: "wrong",
    });
    assert.equal(stale.status, "failed");
    assert.equal(stale.code, "stale_base");
    assert.match(stale.currentSection.content, /changed/);
    const contextBytes = Buffer.byteLength(
      JSON.stringify([read, edited, chained]),
    );
    const wholeFileBytes = Buffer.byteLength(content);
    assert.ok(contextBytes < wholeFileBytes / 100);
    t.diagnostic(
      `10,000-line fixture: whole file ${wholeFileBytes} bytes; section + two edit results ${contextBytes} bytes (tool-result bytes, not tokens).`,
    );
  } finally {
    await tools.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("read pages preserve UTF-8 and every line under byte caps, with explicit EOF and defaults", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-tool-pages-"));
  const tools = new ModelToolSession({ cwd, env: process.env });
  try {
    const port = await tools.prepare(
      budgets,
      { approve: async () => true, update: async () => undefined },
      new AbortController().signal,
    );
    let id = 0;
    const execute = async (args: unknown) =>
      JSON.parse(
        await port.execute({
          id: String(++id),
          name: "read_file",
          arguments: JSON.stringify(args),
        }),
      );
    const content =
      "\uFEFF" +
      Array.from({ length: 410 }, (_, i) => `${i}: å🙂 \"quoted\"\\\r\n`).join(
        "",
      ) +
      "last";
    writeFileSync(join(cwd, "pages.txt"), content);
    const first = JSON.parse((await execute({ path: "pages.txt" })).text);
    assert.equal(first.lines, 200);
    assert.equal(first.next_offset, 200);
    let offset = 0;
    let restored = "";
    do {
      const result = await execute({
        path: "pages.txt",
        offset,
        limit: 10000,
        max_output_bytes: 512,
      });
      assert.equal(result.status, "completed");
      assert.equal(result.truncated, false);
      assert.ok(Buffer.byteLength(result.text) <= 512);
      const page = JSON.parse(result.text);
      assert.equal(page.sha256, first.sha256);
      assert.ok(page.lines > 0);
      assert.ok(!page.content.includes("\uFFFD"));
      restored += page.content;
      offset = page.next_offset;
    } while (offset !== null);
    assert.equal(restored, content);
    const eof = JSON.parse(
      (await execute({ path: "pages.txt", offset: 9999 })).text,
    );
    assert.equal(eof.offset, 411);
    assert.equal(eof.content, "");
    assert.equal(eof.next_offset, null);
    assert.equal(eof.complete, false);
    writeFileSync(join(cwd, "empty.txt"), "");
    const empty = JSON.parse((await execute({ path: "empty.txt" })).text);
    assert.equal(empty.total_lines, 0);
    assert.equal(empty.complete, true);
    for (const args of [
      { offset: -1 },
      { offset: 0.5 },
      { limit: 0 },
      { max_output_bytes: 255 },
    ])
      assert.equal(
        (await execute({ path: "pages.txt", ...args })).status,
        "invalid_arguments",
      );
    writeFileSync(join(cwd, "long.txt"), "x".repeat(10000));
    const long = await execute({ path: "long.txt", max_output_bytes: 512 });
    assert.equal(long.status, "failed");
    assert.match(long.text, /no partial line/);
    writeFileSync(join(cwd, "binary.txt"), Buffer.from([0, 1, 2]));
    assert.equal((await execute({ path: "binary.txt" })).status, "failed");
  } finally {
    await tools.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("native command output caps are per-call and cannot exceed runtime ceilings", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-tool-caps-"));
  const tools = new ModelToolSession({ cwd, env: process.env });
  try {
    const port = await tools.prepare(
      { ...budgets, toolOutputBytes: 1024 },
      { approve: async () => true, update: async () => undefined },
      new AbortController().signal,
    );
    const cmd =
      process.platform === "win32"
        ? "Write-Output ('x' * 5000)"
        : "printf '%5000s' x";
    for (const requested of [256, 100000]) {
      const result = JSON.parse(
        await port.execute({
          id: String(requested),
          name: "exec_command",
          arguments: JSON.stringify({ cmd, max_output_bytes: requested }),
        }),
      );
      assert.equal(result.status, "completed");
      assert.ok(Buffer.byteLength(result.text) <= Math.min(requested, 1024));
      assert.equal(result.truncated, true);
    }
    execFileSync("git", ["init", "--quiet", cwd]);
    for (let i = 0; i < 60; i++)
      writeFileSync(join(cwd, `file-${i}.txt`), "data");
    const git = JSON.parse(
      await port.execute({
        id: "git-cap",
        name: "git",
        arguments: JSON.stringify({
          args: ["status", "--short"],
          max_output_bytes: 256,
        }),
      }),
    );
    assert.equal(git.status, "completed");
    assert.ok(Buffer.byteLength(git.text) <= 256);
    assert.equal(git.truncated, true);
    const read = JSON.parse(
      await port.execute({
        id: "read-cap",
        name: "read_file",
        arguments: JSON.stringify({
          path: "file-0.txt",
          offset: null,
          limit: null,
          max_output_bytes: null,
        }),
      }),
    );
    assert.equal(
      read.status,
      "completed",
      "strict-provider null sentinels retain defaults",
    );
  } finally {
    await tools.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("A008-0198: ACP tools expose pressure only with a durable checkpoint owner", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-continuation-tools-"));
  const session = new ModelToolSession({ cwd, env: process.env });
  const enabled = {
    ...budgets,
    continuationPressureBytes: 80_000,
    continuationMaximumBytes: 100_000,
    continuationReducerInputBytes: 64_000,
    continuationReducerOutputTokens: 512,
    continuationStateBytes: 8_192,
    continuationRecentRawInteractions: 3,
  };
  try {
    await assert.rejects(
      () =>
        prepareAcpTools(
          session,
          "session-test",
          enabled,
          new AbortController().signal,
          async () => undefined,
        ),
      /durable checkpoint owner/u,
    );
    const writes: unknown[] = [];
    const prepared = await prepareAcpTools(
      session,
      "session-test",
      enabled,
      new AbortController().signal,
      async () => undefined,
      undefined,
      async (input) => {
        writes.push(input);
      },
    );
    assert.equal(prepared.continuation?.recentRawInteractions, 3);
    assert.equal(prepared.continuation?.maximumStateBytes, 8_192);
    assert.deepEqual(prepared.continuation?.pressure?.routeBudget, {
      pressureBytes: 80_000,
      maximumBytes: 100_000,
      reducerInputBytes: 64_000,
      reducerOutputTokens: 512,
    });
    assert.equal(writes.length, 0);
  } finally {
    await session.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("generate_image is offered only when the host supplies the shared owner", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-image-tool-"));
  const started: string[] = [];
  const withImage = new ModelToolSession({
    cwd,
    env: process.env,
    generateImage: async (prompt) => {
      started.push(prompt);
    },
  });
  const withoutImage = new ModelToolSession({ cwd, env: process.env });
  try {
    const offered = await withImage.prepare(
      budgets,
      { approve: async () => true, update: async () => undefined },
      new AbortController().signal,
    );
    const hidden = await withoutImage.prepare(
      budgets,
      { approve: async () => true, update: async () => undefined },
      new AbortController().signal,
    );
    assert.equal(
      offered.definitions.some((tool) => tool.name === "generate_image"),
      true,
    );
    assert.equal(
      hidden.definitions.some((tool) => tool.name === "generate_image"),
      false,
    );
    const startedResult = JSON.parse(
      await offered.execute({
        id: "img-1",
        name: "generate_image",
        arguments: JSON.stringify({ prompt: "a red robot on the moon" }),
      }),
    );
    assert.equal(startedResult.status, "completed");
    assert.deepEqual(started, ["a red robot on the moon"]);
    const denied = JSON.parse(
      await offered.execute({
        id: "img-2",
        name: "generate_image",
        arguments: JSON.stringify({ prompt: "no" }),
      }),
    );
    assert.equal(denied.status, "invalid_arguments");
    assert.deepEqual(started, ["a red robot on the moon"]);
  } finally {
    await withImage.close();
    await withoutImage.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("file tools preserve UTF-8/CRLF, reject stale and ambiguous edits, existing files and escaped paths", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-repository-"));
  const outside = mkdtempSync(join(tmpdir(), "a008-outside-"));
  const tools = new ModelToolSession({ cwd, env: process.env });
  try {
    const port = await tools.prepare(
      budgets,
      { approve: async () => true, update: async () => undefined },
      new AbortController().signal,
    );
    let id = 0;
    const execute = async (name: string, args: unknown) =>
      JSON.parse(
        await port.execute({
          id: String(++id),
          name,
          arguments: JSON.stringify(args),
        }),
      );
    const content = "\uFEFFhej å🙂\r\nsecond\r\n";
    assert.equal(
      (await execute("create_file", { path: "nested/new.txt", content }))
        .status,
      "completed",
    );
    const read = JSON.parse(
      (await execute("read_file", { path: "nested/new.txt" })).text,
    );
    assert.equal(read.content, content);
    const edit = {
      path: "nested/new.txt",
      expected_sha256: read.sha256,
      old_text: "second",
      new_text: "changed",
    };
    assert.equal((await execute("edit_file", edit)).status, "completed");
    assert.equal(
      readFileSync(join(cwd, "nested/new.txt"), "utf8"),
      content.replace("second", "changed"),
    );
    const staleEdit = await execute("edit_file", edit);
    assert.equal(staleEdit.status, "failed");
    assert.equal(staleEdit.code, "stale_base");
    assert.equal(staleEdit.written, false);
    assert.equal(
      (
        await execute("create_file", {
          path: "nested/new.txt",
          content: "overwrite",
        })
      ).status,
      "failed",
    );
    writeFileSync(join(cwd, "invalid-utf8.txt"), Buffer.from([0xc3, 0x28]));
    assert.equal(
      (await execute("read_file", { path: "invalid-utf8.txt" })).status,
      "failed",
    );
    writeFileSync(join(cwd, "oversized.txt"), "");
    truncateSync(join(cwd, "oversized.txt"), 16 * 1024 * 1024 + 1);
    const oversized = await execute("read_file", {
      path: "oversized.txt",
      limit: 1,
    });
    assert.equal(oversized.status, "failed");
    assert.match(oversized.text, /16 MiB/);
    const updated = JSON.parse(
      (await execute("read_file", { path: "nested/new.txt" })).text,
    );
    assert.match(
      (
        await execute("edit_file", {
          ...edit,
          expected_sha256: updated.sha256,
          old_text: "\r\n",
          new_text: "\n",
        })
      ).text,
      /exactly once/,
    );
    assert.equal(
      (await execute("read_file", { path: "../outside.txt" })).status,
      "failed",
    );
    assert.equal(
      (await execute("create_file", { path: ".git/config", content: "no" }))
        .status,
      "failed",
    );
    symlinkSync(
      outside,
      join(cwd, "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.equal(
      (
        await execute("create_file", {
          path: "linked/outside.txt",
          content: "no",
        })
      ).status,
      "failed",
    );
    assert.equal(existsSync(join(outside, "outside.txt")), false);
    const listed = JSON.parse(
      (await execute("list_files", { path: ".", limit: 1 })).text,
    );
    assert.equal(listed.entries.length, 1);
    assert.equal(listed.nextOffset, 1);
    assert.equal(
      (await execute("git", { args: ["init", "--quiet"] })).status,
      "completed",
    );
    const literal = "literal; name's.txt";
    await execute("create_file", {
      path: literal,
      content: "literal Git path",
    });
    assert.equal(
      (await execute("git", { args: ["add", "--", literal] })).status,
      "completed",
    );
    assert.match(
      (await execute("git", { args: ["diff", "--cached", "--name-only"] }))
        .text,
      /literal; name's.txt/,
    );
    const tiny = await tools.prepare(
      { ...budgets, toolOutputBytes: 4 },
      { approve: async () => true, update: async () => undefined },
      new AbortController().signal,
    );
    assert.equal(
      JSON.parse(
        await tiny.execute({
          id: "bounded",
          name: "read_file",
          arguments: '{"path":"nested/new.txt"}',
        }),
      ).status,
      "failed",
    );
  } finally {
    await tools.close();
    rmSync(cwd, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("sectional edit retains external-change, literal mixed-ending and approval guards", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-tool-edit-guards-"));
  const tools = new ModelToolSession({ cwd, env: process.env });
  try {
    let allow = true;
    const port = await tools.prepare(
      budgets,
      { approve: async () => allow, update: async () => undefined },
      new AbortController().signal,
    );
    let id = 0;
    const execute = async (name: string, args: unknown) =>
      JSON.parse(
        await port.execute({
          id: String(++id),
          name,
          arguments: JSON.stringify(args),
        }),
      );
    const content = "first\r\nsecond\nthird\r\n";
    writeFileSync(join(cwd, "mixed.txt"), content);
    const read = JSON.parse(
      (await execute("read_file", { path: "mixed.txt", offset: 1, limit: 1 }))
        .text,
    );
    const edit = {
      path: "mixed.txt",
      expected_sha256: read.sha256,
      old_text: "second\r\n",
      new_text: "changed\r\n",
    };
    assert.equal(
      (await execute("edit_file", edit)).status,
      "failed",
      "mixed endings must remain literal",
    );
    allow = false;
    assert.equal(
      (await execute("edit_file", { ...edit, old_text: "second\n" })).status,
      "denied",
    );
    assert.equal(readFileSync(join(cwd, "mixed.txt"), "utf8"), content);
    allow = true;
    writeFileSync(
      join(cwd, "mixed.txt"),
      content + "external write outside selected section\n",
    );
    const stale = await execute("edit_file", { ...edit, old_text: "second\n" });
    assert.equal(stale.status, "failed");
    assert.equal(stale.code, "stale_base");
    assert.equal(stale.written, false);
    assert.equal(
      readFileSync(join(cwd, "mixed.txt"), "utf8"),
      content + "external write outside selected section\n",
    );
  } finally {
    await tools.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("transactional native edit keeps success compact and failure recovery bounded", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-edit-recovery-"));
  const tools = new ModelToolSession({ cwd, env: process.env });
  try {
    const port = await tools.prepare(
      budgets,
      { approve: async () => true, update: async () => undefined },
      new AbortController().signal,
    );
    let id = 0;
    const executeRaw = (name: string, args: unknown) =>
      port.execute({
        id: String(++id),
        name,
        arguments: JSON.stringify(args),
      });
    const execute = async (name: string, args: unknown) =>
      JSON.parse(await executeRaw(name, args));

    const target = join(cwd, "target.txt");
    writeFileSync(target, "alpha\nBETA\ngamma\n");
    const firstRead = JSON.parse(
      (await execute("read_file", { path: "target.txt", offset: 1, limit: 1 }))
        .text,
    );
    const successRaw = await executeRaw("edit_file", {
      path: "target.txt",
      expected_sha256: firstRead.sha256,
      old_text: "BETA",
      new_text: "BETA2",
    });
    const successBytes = Buffer.byteLength(successRaw, "utf8");
    assert.ok(
      successBytes <= 256,
      "successful edit receipt grew to " + successBytes + " bytes",
    );
    const success = JSON.parse(successRaw);
    assert.equal(success.status, "completed");
    const receipt = JSON.parse(success.text);
    assert.equal(receipt.edited, true);
    assert.equal(readFileSync(target, "utf8"), "alpha\nBETA2\ngamma\n");

    const staleRaw = await executeRaw("edit_file", {
      path: "target.txt",
      expected_sha256: firstRead.sha256,
      old_text: "BETA2",
      new_text: "BETA3",
    });
    const stale = JSON.parse(staleRaw);
    assert.equal(stale.status, "failed");
    assert.equal(stale.code, "stale_base");
    assert.equal(stale.retryable, true);
    assert.equal(stale.written, false);
    assert.equal(stale.currentSha256, receipt.sha256);
    assert.match(stale.currentSection.content, /BETA2/);
    assert.ok(Buffer.byteLength(staleRaw, "utf8") <= EDIT_FAILURE_OUTPUT_BYTES);
    assert.equal(readFileSync(target, "utf8"), "alpha\nBETA2\ngamma\n");

    const noMatchRaw = await executeRaw("edit_file", {
      path: "target.txt",
      expected_sha256: receipt.sha256,
      old_text: "BETAA2",
      new_text: "BETA3",
    });
    const noMatch = JSON.parse(noMatchRaw);
    assert.equal(noMatch.code, "no_exact_match");
    assert.equal(noMatch.written, false);
    assert.ok(noMatch.closestMatch.similarity >= 0.7);
    assert.match(noMatch.closestMatch.content, /BETA2/);
    assert.ok(
      Buffer.byteLength(noMatchRaw, "utf8") <= EDIT_FAILURE_OUTPUT_BYTES,
    );
    assert.equal(readFileSync(target, "utf8"), "alpha\nBETA2\ngamma\n");

    writeFileSync(target, "same\nmiddle\nsame\n");
    const duplicateRead = JSON.parse(
      (await execute("read_file", { path: "target.txt", limit: 1 })).text,
    );
    const ambiguousRaw = await executeRaw("edit_file", {
      path: "target.txt",
      expected_sha256: duplicateRead.sha256,
      old_text: "same",
      new_text: "changed",
    });
    const ambiguous = JSON.parse(ambiguousRaw);
    assert.equal(ambiguous.code, "ambiguous_match");
    assert.equal(ambiguous.actualOccurrences, 2);
    assert.equal(ambiguous.matches.length, 2);
    assert.equal(ambiguous.written, false);
    assert.ok(
      Buffer.byteLength(ambiguousRaw, "utf8") <= EDIT_FAILURE_OUTPUT_BYTES,
    );
    assert.equal(readFileSync(target, "utf8"), "same\nmiddle\nsame\n");

    writeFileSync(target, "one\rtwo\r");
    const crRead = JSON.parse(
      (await execute("read_file", { path: "target.txt", offset: 1, limit: 1 }))
        .text,
    );
    const crEdit = await execute("edit_file", {
      path: "target.txt",
      expected_sha256: crRead.sha256,
      old_text: "two\n",
      new_text: "TWO\n",
    });
    assert.equal(crEdit.status, "completed");
    assert.equal(readFileSync(target, "utf8"), "one\rTWO\r");
  } finally {
    await tools.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("same-path native edits serialize and stale loser cannot clobber winner", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-edit-lock-"));
  const tools = new ModelToolSession({ cwd, env: process.env });
  try {
    const port = await tools.prepare(
      budgets,
      { approve: async () => true, update: async () => undefined },
      new AbortController().signal,
    );
    const target = join(cwd, "race.txt");
    writeFileSync(target, "left\nright\n");
    const read = JSON.parse(
      JSON.parse(
        await port.execute({
          id: "read",
          name: "read_file",
          arguments: JSON.stringify({ path: "race.txt", limit: 1 }),
        }),
      ).text,
    );
    const [aRaw, bRaw] = await Promise.all([
      port.execute({
        id: "edit-a",
        name: "edit_file",
        arguments: JSON.stringify({
          path: "race.txt",
          expected_sha256: read.sha256,
          old_text: "left",
          new_text: "LEFT",
        }),
      }),
      port.execute({
        id: "edit-b",
        name: "edit_file",
        arguments: JSON.stringify({
          path: "race.txt",
          expected_sha256: read.sha256,
          old_text: "right",
          new_text: "RIGHT",
        }),
      }),
    ]);
    const results = [JSON.parse(aRaw), JSON.parse(bRaw)];
    assert.equal(
      results.filter((result) => result.status === "completed").length,
      1,
    );
    const stale = results.find((result) => result.code === "stale_base");
    assert.ok(stale);
    assert.equal(stale.written, false);
    assert.ok(
      ["LEFT\nright\n", "left\nRIGHT\n"].includes(readFileSync(target, "utf8")),
    );
  } finally {
    await tools.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("atomic edit adoption failure preserves or restores the exact original bytes", () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-edit-atomic-"));
  try {
    const target = join(cwd, "atomic.txt");
    const original = Buffer.from("before\r\nexact\r\n", "utf8");
    writeFileSync(target, original);

    const refused = atomicAdoptText({
      path: target,
      originalBytes: original,
      candidateText: "after\r\nexact\r\n",
      adopt: () => {
        throw new Error("forced adoption failure");
      },
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) assert.equal(refused.failure.code, "adoption_failed");
    assert.deepEqual(readFileSync(target), original);

    const corrupted = atomicAdoptText({
      path: target,
      originalBytes: original,
      candidateText: "after\r\nexact\r\n",
      adopt: (_candidate, destination) => {
        writeFileSync(destination, "corrupt", "utf8");
      },
    });
    assert.equal(corrupted.ok, false);
    if (!corrupted.ok)
      assert.equal(corrupted.failure.code, "validation_failed");
    assert.deepEqual(readFileSync(target), original);
    assert.equal(
      readdirSync(cwd).some((name) => name.startsWith(".a008-")),
      false,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test(
  "standalone GUI approval drives real file read/create/edit, literal Git and shell results back to the model",
  { timeout: 45000 },
  async () => {
    let step = 0;
    const provider = await startSessionControlProvider((payload) => {
      const observed = payload.messages.filter((m: any) => m.role === "tool");
      if (
        payload.messages
          .filter((m: any) => m.role === "user")
          .at(-1)
          .content.includes("DENY-WRITE")
      ) {
        if (observed.length) {
          assert.match(observed.at(-1).content, /denied/);
          return {
            role: "assistant",
            content: "The write was denied; nothing created.",
          };
        }
        return {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "denied-write",
              type: "function",
              function: {
                name: "create_file",
                arguments: JSON.stringify({
                  path: "denied.txt",
                  content: "must not exist",
                }),
              },
            },
          ],
        };
      }
      const last = observed.at(-1);
      let name: string, args: unknown;
      switch (step++) {
        case 0:
          name = "read_file";
          args = { path: "AGENTS.md" };
          break;
        case 1:
          assert.match(last.content, /Fixture repository instructions/);
          name = "list_files";
          args = { path: "." };
          break;
        case 2:
          assert.match(last.content, /AGENTS.md/);
          name = "create_file";
          args = { path: "hello.txt", content: "before\n" };
          break;
        case 3:
          name = "read_file";
          args = { path: "hello.txt" };
          break;
        case 4:
          name = "edit_file";
          args = {
            path: "hello.txt",
            expected_sha256: JSON.parse(JSON.parse(last.content).text).sha256,
            old_text: "before",
            new_text: "after",
          };
          break;
        case 5:
          assert.match(last.content, /completed/);
          name = "git";
          args = { args: ["status", "--short"] };
          break;
        case 6:
          assert.match(last.content, /hello.txt/);
          name = "exec_command";
          args = {
            cmd:
              process.platform === "win32"
                ? "Get-Content -LiteralPath hello.txt"
                : "cat hello.txt",
          };
          break;
        default:
          assert.match(last.content, /after/);
          return {
            role: "assistant",
            content: "Verified file edit and Git status.",
            reasoning_content: "Transient fixture thought.",
          };
      }
      return {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: `repo-${step}`,
            type: "function",
            function: { name, arguments: JSON.stringify(args) },
          },
        ],
      };
    });
    const f = isolatedMemoryEnv({
      NVIDIA_CHAT_COMPLETIONS_URL: provider.endpoint,
      PATH: process.env.PATH,
    });
    const cwd = join(f.directory, "project");
    mkdirSync(cwd);
    writeFileSync(join(cwd, "AGENTS.md"), "Fixture repository instructions.");
    execFileSync("git", ["init", "--quiet", cwd]);
    const host = await startGuiHost({
      env: { ...f.env, A008_GUI_WORKSPACE: cwd },
      port: 0,
    });
    const client = await WireClient.open(host.port);
    try {
      client.send({ type: "session/new", requestId: "new" });
      const opened = await client.until("session/new/ok");
      assert.equal(opened.type, "session/new/ok", JSON.stringify(opened));
      assert.equal(opened.state.runtime.cwd.toLowerCase(), cwd.toLowerCase());
      assert.deepEqual(
        opened.state.runtime.tools.map((tool: any) => tool.name),
        [
          "exec_command",
          "list_files",
          "read_file",
          "create_file",
          "edit_file",
          "git",
        ],
      );
      const sessionId = opened.sessionId;
      client.send({
        type: "prompt",
        requestId: "work",
        sessionId,
        text: "Read AGENTS.md, list root, create and edit a file, inspect Git and verify it.",
      });
      let approvals = 0;
      while (true) {
        const frame = await client.next();
        assert.notEqual(frame.type, "error", JSON.stringify(frame));
        if (frame.type === "tool/permission") {
          approvals++;
          if (frame.title === "create_file")
            assert.equal(existsSync(join(cwd, "hello.txt")), false);
          if (frame.title === "edit_file")
            assert.equal(
              readFileSync(join(cwd, "hello.txt"), "utf8"),
              "before\n",
            );
          client.send({
            type: "tool/permission",
            requestId: `allow-${approvals}`,
            sessionId,
            permissionId: frame.id,
            allow: true,
          });
        }
        if (frame.type === "prompt/ok") {
          assert.equal(frame.state.messages.length, 2);
          assert.equal(
            frame.state.messages[1].content,
            "Verified file edit and Git status.",
          );
          break;
        }
      }
      assert.equal(approvals, 7);
      assert.equal(readFileSync(join(cwd, "hello.txt"), "utf8"), "after\n");
      assert.equal(
        client.frames.filter(
          (frame) => frame.type === "tool" && frame.status === "completed",
        ).length,
        7,
      );
      const semantic = provider.requests.filter((p) =>
        String(p.messages.at(-1)?.content).includes('"operation"'),
      );
      assert.ok(semantic.length > 0);
      assert.equal(
        JSON.stringify(semantic).includes("Fixture repository instructions"),
        false,
      );
      assert.equal(
        JSON.stringify(semantic).includes("Transient fixture thought"),
        false,
      );
      assert.equal(
        JSON.stringify(client.frames).includes(f.env.NVIDIA_API_KEY!),
        false,
      );
      client.send({
        type: "prompt",
        requestId: "deny",
        sessionId,
        text: "DENY-WRITE",
      });
      const pending = await client.until("tool/permission");
      assert.equal(pending.type, "tool/permission");
      assert.equal(existsSync(join(cwd, "denied.txt")), false);
      client.send({
        type: "tool/permission",
        requestId: "reject",
        sessionId,
        permissionId: pending.id,
        allow: false,
      });
      assert.equal(
        (await client.until("prompt/ok", "deny")).state.messages.at(-1).content,
        "The write was denied; nothing created.",
      );
      assert.equal(existsSync(join(cwd, "denied.txt")), false);
    } finally {
      client.socket.close();
      await host.close();
      await provider.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

const command =
  process.platform === "win32"
    ? "Set-Content -LiteralPath 'result.txt' -Value 'real execution'; Get-Content -LiteralPath 'result.txt'"
    : "printf 'real execution' > result.txt; cat result.txt";
const call = {
  id: "call-proof",
  name: "exec_command",
  arguments: JSON.stringify({ cmd: command }),
};
const providerCall = {
  id: call.id,
  type: "function",
  function: { name: call.name, arguments: call.arguments },
};

test("JSON tool-only completion executes after approval and actual result continues the provider turn without polluting history", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-tools-"));
  const tools = new ModelToolSession({
    cwd,
    env: { ...process.env, NVIDIA_API_KEY: "test-secret-not-in-child" },
  });
  const requests: any[] = [],
    activity: ToolActivity[] = [];
  const transport = new NvidiaChatTransport({
    apiKey: "synthetic",
    fetch: async (_url, init) => {
      const payload = JSON.parse(String(init?.body));
      requests.push(payload);
      const next =
        requests.length === 1
          ? { content: null, tool_calls: [providerCall] }
          : { content: "I read the real result." };
      return Response.json({
        choices: [
          {
            message: { role: "assistant", ...next },
            finish_reason: requests.length === 1 ? "tool_calls" : "stop",
          },
        ],
      });
    },
  });
  try {
    const port = await tools.prepare(
      budgets,
      {
        approve: async () => {
          assert.equal(existsSync(join(cwd, "result.txt")), false);
          return true;
        },
        update: async (a) => {
          activity.push(a);
        },
      },
      new AbortController().signal,
    );
    const chat = new ChatSession({
      model: "fixture",
      transport,
      generation: { stream: false },
    });
    const deltas: string[] = [];
    await chat.send("Write and inspect a fixture.", {
      tools: port,
      onDelta: (d) => {
        if (d.type === "content") deltas.push(d.text);
      },
    });
    assert.equal(
      readFileSync(join(cwd, "result.txt"), "utf8").trim(),
      "real execution",
    );
    assert.equal(requests[0].tools[0].function.name, "exec_command");
    assert.equal(requests[1].messages.at(-1).role, "tool");
    assert.equal(requests[1].messages.at(-1).tool_call_id, call.id);
    assert.match(requests[1].messages.at(-1).content, /real execution/);
    assert.deepEqual(
      activity.map((a) => a.status),
      ["pending", "in_progress", "completed"],
    );
    assert.deepEqual(
      chat.messages.map((m) => m.content),
      ["Write and inspect a fixture.", "I read the real result."],
    );
    assert.deepEqual(deltas, ["I read the real result."]);
  } finally {
    await tools.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("streamed function fragments assemble into one typed call; prose and duplicate ids never become tools", async () => {
  const chunks = [
    {
      index: 0,
      id: "call-sse",
      type: "function",
      function: { name: "exec_", arguments: '{"cmd":' },
    },
    { index: 0, function: { name: "command", arguments: '"echo fixture"}' } },
  ];
  const body =
    chunks
      .map(
        (c) =>
          `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [c] } }] })}\n\n`,
      )
      .join("") + "data: [DONE]\n\n";
  const transport = new NvidiaChatTransport({
    apiKey: "synthetic",
    fetch: async () => new Response(body),
  });
  const completion = await transport.complete({
    model: "fixture",
    messages: [],
  });
  assert.deepEqual(completion.toolCalls, [
    {
      id: "call-sse",
      name: "exec_command",
      arguments: '{"cmd":"echo fixture"}',
    },
  ]);
  const chat = new ChatSession({
    model: "fixture",
    transport: {
      complete: async () => ({
        message: {
          role: "assistant",
          content: "I will run /shell echo fixture",
        },
      }),
    },
  });
  await chat.send("Hello");
  assert.equal(chat.messages.length, 2);
  const invalid = new NvidiaChatTransport({
    apiKey: "synthetic",
    fetch: async () =>
      Response.json({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [providerCall, providerCall],
            },
          },
        ],
      }),
  });
  await assert.rejects(
    invalid.complete({
      model: "fixture",
      messages: [],
      options: { stream: false },
    }),
    /duplicate/,
  );
});

test("denial and invalid arguments execute nothing; tool loop budget stops repeated work", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-tools-denied-"));
  const tools = new ModelToolSession({ cwd, env: process.env });
  let approvals = 0;
  try {
    const port = await tools.prepare(
      budgets,
      {
        approve: async () => {
          approvals++;
          return false;
        },
        update: async () => undefined,
      },
      new AbortController().signal,
    );
    assert.equal(JSON.parse(await port.execute(call)).status, "denied");
    assert.equal(
      JSON.parse(
        await port.execute({
          ...call,
          arguments: '{"cmd":"echo x", "cwd":"/"}',
        }),
      ).status,
      "invalid_arguments",
    );
    assert.equal(approvals, 1);
    assert.equal(existsSync(join(cwd, "result.txt")), false);
    let round = 0;
    const chat = new ChatSession({
      model: "fixture",
      transport: {
        complete: async () => ({
          message: { role: "assistant", content: "" },
          toolCalls: [{ ...call, id: `round-${++round}` }],
        }),
      },
    });
    await assert.rejects(
      chat.send("Keep calling", { tools: { ...port, maximumCalls: 1 } }),
      /Tool call budget/,
    );
    assert.equal(chat.messages.length, 0);
    assert.equal(round, 2);
  } finally {
    await tools.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("cancelled ACP approval settles without waiting for an unresponsive client and no command runs", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-tools-cancel-"));
  const tools = new ModelToolSession({ cwd, env: process.env });
  const controller = new AbortController();
  try {
    const port = await prepareAcpTools(
      tools,
      "fixture-session",
      budgets,
      controller.signal,
      async () => undefined,
      async () => {
        controller.abort();
        return new Promise(() => undefined);
      },
    );
    await assert.rejects(
      port.execute(call, controller.signal),
      /abort|cancel/i,
    );
    assert.equal(existsSync(join(cwd, "result.txt")), false);
  } finally {
    await tools.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("real shell timeout and cancellation terminate execution; UTF-8 observation truncation is explicit", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-tools-timeout-"));
  const sleep =
    process.platform === "win32" ? "Start-Sleep -Seconds 30" : "sleep 30";
  try {
    const result = await runTerminalCommand({
      command: sleep,
      cwd,
      shell: "powershell",
      timeoutMs: 200,
    });
    assert.equal(result.timedOut, true);
    assert.notEqual(result.exitCode, 0);
    const signal = AbortSignal.timeout(200);
    await assert.rejects(
      runTerminalCommand({ command: sleep, cwd, shell: "powershell", signal }),
      /cancelled/,
    );
    const bounded = boundedToolText("å🙂".repeat(30), 13);
    assert.equal(bounded.truncated, true);
    assert.ok(Buffer.byteLength(bounded.text) <= 13);
    assert.equal(bounded.text.includes("�"), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("strict-provider null sentinels restore optional MCP arguments before original-schema validation", () => {
  const parameters = {
    type: "object",
    properties: {
      url: { type: "string" },
      restore: { oneOf: [{ type: "boolean" }, { type: "string" }] },
      requiredFlag: { type: "boolean" },
      explicitNull: { type: ["string", "null"] },
    },
    required: ["url", "requiredFlag", "explicitNull"],
    additionalProperties: false,
  };
  assert.deepEqual(
    normalizeOptionalNullArguments(parameters, {
      url: "https://example.com",
      restore: null,
      requiredFlag: null,
      explicitNull: null,
    }),
    {
      url: "https://example.com",
      requiredFlag: null,
      explicitNull: null,
    },
  );
});

test("approved stdio MCP server is discovered, schema validated, executed and closed in the project", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-tools-mcp-"));
  const tools = new ModelToolSession({
    cwd,
    env: process.env,
    mcpServers: [
      {
        name: "fixture",
        command: process.execPath,
        args: [resolve("dist/test/fixtures/tool-mcp.js")],
        env: [],
      },
    ],
  });
  try {
    const port = await tools.prepare(
      budgets,
      { approve: async () => true, update: async () => undefined },
      new AbortController().signal,
    );
    const writeName = port.definitions.find((definition) =>
      definition.description.includes("fixture_write"),
    )!.name;
    const output = await port.execute({
      id: "mcp-proof",
      name: writeName,
      arguments: '{"text":"mcp proof"}',
    });
    assert.match(output, /MCP fixture written/);
    assert.equal(
      readFileSync(join(cwd, "mcp-fixture.txt"), "utf8"),
      "mcp proof",
    );
    const optionalName = port.definitions.find((definition) =>
      definition.description.includes("fixture_optional"),
    )!.name;
    const normalized = JSON.parse(
      await port.execute({
        id: "mcp-optional-null",
        name: optionalName,
        arguments: '{"url":"https://example.com","restore":null}',
      }),
    );
    assert.equal(normalized.status, "completed");
    assert.deepEqual(JSON.parse(JSON.parse(normalized.text).content[0].text), {
      url: "https://example.com",
    });
  } finally {
    await tools.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("MCP strict policy validates original arguments before approval and effects in both modes", async () => {
  for (const strict of [true, false]) {
    const cwd = mkdtempSync(join(tmpdir(), "a008-mcp-policy-"));
    let approvals = 0;
    const tools = new ModelToolSession({
      cwd,
      env: process.env,
      mcpServers: activeMcpServers(
        parseUserCatalog({
          version: 1,
          mcpServers: [
            {
              name: "fixture",
              command: process.execPath,
              args: [resolve("dist/test/fixtures/tool-mcp.js")],
              env: [],
              strict,
              toolStrict: { fixture_scope: !strict },
            },
          ],
        }),
      ),
    });
    try {
      const port = await tools.prepare(
        budgets,
        {
          approve: async () => {
            approvals++;
            return true;
          },
          update: async () => undefined,
        },
        new AbortController().signal,
      );
      const find = (name: string) =>
        port.definitions.find((d) =>
          d.description.startsWith(`fixture: ${name}.`),
        )!;
      assert.equal(find("fixture_write").strict, strict);
      assert.equal(find("fixture_scope").strict, !strict);
      for (const args of [
        '{"text":4}',
        '{"text":"ok","extra":true}',
        '{"text":null}',
        "{broken",
      ]) {
        assert.match(
          await port.execute({
            id: "bad",
            name: find("fixture_write").name,
            arguments: args,
          }),
          /invalid_arguments/,
        );
      }
      assert.equal(approvals, 0);
      assert.equal(existsSync(join(cwd, "mcp-fixture.txt")), false);
      const result = await port.execute({
        id: "optional",
        name: find("fixture_optional").name,
        arguments: '{"url":"https://example.test","restore":null}',
      });
      assert.match(result, strict ? /completed/ : /invalid_arguments/);
      assert.equal(approvals, strict ? 1 : 0);
      await port.execute({
        id: "good",
        name: find("fixture_write").name,
        arguments: '{"text":"validated"}',
      });
      assert.equal(
        readFileSync(join(cwd, "mcp-fixture.txt"), "utf8"),
        "validated",
      );
    } finally {
      await tools.close();
      rmSync(cwd, { recursive: true, force: true });
    }
  }
});

test("runtime MCP binding owns session and rejects containment with replay", () => {
  const schema = {
    type: "object",
    properties: {
      url: { type: "string" },
      session: { type: "string" },
      allowedDomains: { type: "array", items: { type: "string" } },
      restore: { type: "string" },
    },
    required: ["url", "session"],
    additionalProperties: false,
  };
  const presented = presentMcpSchema(schema);
  const properties = presented.properties as Record<string, unknown>;
  assert.equal(properties.session, undefined);
  assert.deepEqual(presented.required, ["url"]);
  const bound = bindRuntimeMcpArguments(
    schema,
    { url: "https://example.com", session: "model-picked" },
    "scope-a",
  );
  assert.equal(bound.ok, true);
  if (bound.ok) assert.equal(bound.arguments.session, "scope-a");
  const blocked = bindRuntimeMcpArguments(
    schema,
    {
      url: "https://example.com",
      allowedDomains: ["example.com"],
      restore: "snap",
    },
    "scope-a",
  );
  assert.equal(blocked.ok, false);
});

test("tool sessions keep distinct stable MCP scopes and do not execute containment with replay", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-mcp-scope-"));
  const server = {
    name: "fixture",
    command: process.execPath,
    args: [resolve("dist/test/fixtures/tool-mcp.js")],
    env: [{ name: "MODE", value: "probe" }],
  };
  const env = { ...process.env, NVIDIA_API_KEY: "supersecret-mcp" };
  const open = (executionId: string) =>
    new ModelToolSession({ cwd, env, executionId, mcpServers: [server] });
  const first = open("chat-a");
  const second = open("chat-b");
  const approval = { approve: async () => true, update: async () => undefined };
  try {
    const portA = await first.prepare(
      budgets,
      approval,
      new AbortController().signal,
    );
    const portB = await second.prepare(
      budgets,
      approval,
      new AbortController().signal,
    );
    const definition = portA.definitions.find((item) =>
      item.description.includes("fixture_scope"),
    )!;
    const properties = definition.parameters.properties as Record<
      string,
      unknown
    >;
    assert.equal(properties.session, undefined);
    const call = async (
      port: typeof portA,
      id: string,
      args: Record<string, unknown>,
    ) =>
      JSON.parse(
        await port.execute({
          id,
          name: definition.name,
          arguments: JSON.stringify(args),
        }),
      ) as { status: string; text: string };
    const read = (output: { text: string }) =>
      JSON.parse(JSON.parse(output.text).content[0].text) as {
        arguments: { session?: string };
        scope: string;
        execution: string;
        secret: boolean;
      };
    const a1 = await call(portA, "a1", {
      url: "https://example.com",
      session: "model-picked",
    });
    const a2 = await call(portA, "a2", { url: "https://example.com" });
    const b1 = await call(portB, "b1", { url: "https://www.iana.org" });
    assert.equal(a1.status, "completed");
    const firstScope = read(a1);
    assert.equal(firstScope.execution, "chat-a");
    assert.equal(firstScope.secret, false);
    assert.equal(firstScope.arguments.session, firstScope.scope);
    assert.notEqual(firstScope.arguments.session, "model-picked");
    assert.equal(read(a2).arguments.session, firstScope.scope);
    const secondScope = read(b1);
    assert.equal(secondScope.execution, "chat-b");
    assert.notEqual(secondScope.scope, firstScope.scope);
    rmSync(join(cwd, "mcp-scope-called.txt"), { force: true });
    const blocked = await call(portA, "blocked", {
      url: "https://example.com",
      allowedDomains: ["example.com"],
      restore: "snap",
    });
    assert.equal(blocked.status, "invalid_arguments");
    assert.match(blocked.text, /fresh context/u);
    assert.equal(existsSync(join(cwd, "mcp-scope-called.txt")), false);
  } finally {
    await first.close();
    await second.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("ephemeral MCP probe reports ready, handshake failure, catalog failure, and a missing process", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-mcp-probe-"));
  const report = join(cwd, "report.json");
  const fixture = {
    name: "fixture",
    command: process.execPath,
    args: [resolve("dist/test/fixtures/tool-mcp.js")],
    env: [] as { name: string; value: string }[],
  };
  try {
    const ready = await probeStdioMcpServer({
      server: {
        ...fixture,
        env: [
          { name: "A008_PROBE_REPORT", value: report },
          { name: "MODE", value: "probe" },
          { name: "A008_MCP_SERVER_SCOPE", value: "configured-must-lose" },
        ],
      },
      cwd,
      env: toolEnvironment({
        ...process.env,
        NVIDIA_API_KEY: "supersecret-mcp",
      }),
      executionId: "probe-1",
    });
    assert.equal(ready.status, "ready");
    assert.equal(ready.toolCount, 3);
    assert.deepEqual([...ready.lines], ["3 tools discovered"]);
    const observed = JSON.parse(readFileSync(report, "utf8")) as {
      pid: number;
      secret: boolean;
      mode: string;
      scope: string;
      execution: string;
    };
    assert.equal(observed.secret, false);
    assert.equal(observed.mode, "probe");
    assert.equal(observed.execution, "probe-1");
    assert.notEqual(observed.scope, "configured-must-lose");
    assert.equal(observed.scope.length, 32);
    assert.throws(() => process.kill(observed.pid, 0));
    const handshake = await probeStdioMcpServer({
      server: {
        ...fixture,
        env: [{ name: "FIXTURE_MODE", value: "exit" }],
      },
      cwd,
      env: toolEnvironment(process.env),
    });
    assert.equal(handshake.status, "failed");
    assert.equal(handshake.stage, "handshake");
    assert.deepEqual(
      [...handshake.lines],
      ["process started", "MCP handshake failed"],
    );
    const invalid = await probeStdioMcpServer({
      server: {
        ...fixture,
        env: [{ name: "FIXTURE_MODE", value: "bad-catalog" }],
      },
      cwd,
      env: toolEnvironment(process.env),
    });
    assert.equal(invalid.status, "failed");
    assert.equal(invalid.stage, "catalog");
    assert.deepEqual(
      [...invalid.lines],
      ["process started", "MCP catalog validation failed"],
    );
    const missing = await probeStdioMcpServer({
      server: {
        name: "missing",
        command: "a008-missing-mcp-binary",
        args: [],
        env: [],
      },
      cwd,
      env: toolEnvironment(process.env),
    });
    assert.equal(missing.status, "failed");
    assert.equal(missing.stage, "process");
    assert.deepEqual([...missing.lines], ["process did not start"]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("installed agent-browser MCP initializes and publishes its core catalog", async () => {
  const command =
    process.platform === "win32"
      ? resolve("node_modules/.bin/agent-browser.cmd")
      : resolve("node_modules/.bin/agent-browser");
  const result = await probeStdioMcpServer({
    server: { name: "agent-browser", command, args: ["mcp"], env: [] },
    cwd: process.cwd(),
    env: toolEnvironment(process.env),
    timeoutMs: 30_000,
  });
  assert.equal(result.status, "ready");
  assert.equal(result.stage, "close");
  assert.ok((result.toolCount ?? 0) > 0);
});
test("existing version 1 global settings migrate without losing instructions, budgets or revision protection", () => {
  const cwd = mkdtempSync(join(tmpdir(), "a008-settings-v1-"));
  const path = join(cwd, "settings.json");
  const oldBudgets = { ...budgets } as Record<string, number>;
  for (const key of [
    "maximumToolCalls",
    "maximumToolDefinitions",
    "toolOutputBytes",
    "toolTimeoutMs",
    "continuationPressureBytes",
    "continuationMaximumBytes",
    "continuationReducerInputBytes",
    "continuationReducerOutputTokens",
    "continuationStateBytes",
    "continuationRecentRawInteractions",
  ])
    delete oldBudgets[key];
  oldBudgets.chatInputBytes = 76543;
  writeFileSync(
    path,
    JSON.stringify({
      version: 1,
      settings: {
        instructions: "User-owned instruction.",
        budgets: oldBudgets,
      },
    }),
  );
  try {
    const store = new RuntimePreferencesStore(
      { A008_SETTINGS_PATH: path },
      180000,
    );
    const first = store.snapshot();
    assert.equal(first.settings.instructions, "User-owned instruction.");
    assert.equal(first.settings.budgets.chatInputBytes, 76543);
    assert.equal(
      first.settings.budgets.maximumToolCalls,
      budgets.maximumToolCalls,
    );
    assert.equal(JSON.parse(readFileSync(path, "utf8")).version, 1);
    store.save(first.settings, first.revision);
    assert.equal(JSON.parse(readFileSync(path, "utf8")).version, 5);
    assert.throws(
      () => store.save(first.settings, first.revision),
      /changed elsewhere/,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("tool schemas and observations consume the input budget and failed continuations do not commit history", async () => {
  let executed = 0,
    requests = 0;
  const chat = new ChatSession({
    model: "fixture",
    transport: {
      complete: async () => {
        requests++;
        return {
          message: { role: "assistant", content: "" },
          toolCalls: [call],
        };
      },
    },
  });
  const tools = {
    definitions: [
      {
        name: call.name,
        description: "fixture",
        parameters: { type: "object" },
      },
    ],
    maximumCalls: 2,
    execute: async () => {
      executed++;
      return "x".repeat(2000);
    },
  };
  await assert.rejects(
    chat.send("Fixture", {
      tools,
      invocation: {
        budget: {
          maximum: 1000,
          measurer: {
            unit: "utf8-bytes",
            measure: (value) => Buffer.byteLength(value),
          },
        },
      },
    }),
    /budget/i,
  );
  assert.equal(requests, 1);
  assert.equal(executed, 1);
  assert.equal(chat.messages.length, 0);
});
