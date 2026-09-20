import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  existsSync,
  rmSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ChatSession } from "../src/core/chat-session.js";
import { NvidiaChatTransport } from "../src/providers/nvidia/nvidia-chat-transport.js";
import {
  ModelToolSession,
  boundedToolText,
  type ToolActivity,
} from "../src/tools/model-tools.js";
import { DEFAULT_RUNTIME_BUDGETS as budgets } from "../src/core/runtime-preferences.js";
import { RuntimePreferencesStore } from "../src/runtime/runtime-preferences-store.js";
import { runTerminalCommand } from "../src/tools/terminal.js";
import { prepareAcpTools } from "../src/tools/acp-tools.js";
import { isolatedMemoryEnv } from "./helpers.js";
import { startGuiHost } from "../src/gui-host/server.js";
import { startSessionControlProvider } from "./fixtures/session-control-provider.js";
import { WireClient } from "./fixtures/gui-wire-client.js";

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
    assert.match((await execute("edit_file", edit)).text, /changed since/);
    assert.equal(
      (
        await execute("create_file", {
          path: "nested/new.txt",
          content: "overwrite",
        })
      ).status,
      "failed",
    );
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
    const name = port.definitions.find((d) => d.name.startsWith("mcp_"))!.name;
    const output = await port.execute({
      id: "mcp-proof",
      name,
      arguments: '{"text":"mcp proof"}',
    });
    assert.match(output, /MCP fixture written/);
    assert.equal(
      readFileSync(join(cwd, "mcp-fixture.txt"), "utf8"),
      "mcp proof",
    );
  } finally {
    await tools.close();
    rmSync(cwd, { recursive: true, force: true });
  }
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
    assert.equal(JSON.parse(readFileSync(path, "utf8")).version, 4);
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
