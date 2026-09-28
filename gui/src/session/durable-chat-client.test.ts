import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  cookieCredentials,
  DEFAULT_GUI_MODEL,
} from "../../../packages/client/src/index.js";
import { DurableChatClient, durableChatHttp } from "./durable-chat-client.js";

test("standalone sidebar uses durable creation and selection while runs are busy", () => {
  const hook = readFileSync(
    fileURLToPath(new URL("./use-gui-session.ts", import.meta.url)),
    "utf8",
  );
  const sidebar = readFileSync(
    fileURLToPath(new URL("../projects/project-sidebar.tsx", import.meta.url)),
    "utf8",
  );
  assert.match(
    hook,
    /engineAccessToken\(\) \|\| options \? useLegacyGuiSession\(options\) : useDurableChat\(\)/u,
  );
  assert.match(sidebar, /props\.session\.durable\.sidebar\(\)/u);
  assert.match(
    sidebar,
    /props\.session\.durable\.selectChat\(project\.projectId/u,
  );
  assert.match(
    sidebar,
    /!props\.session\.durable && (?:Boolean\()?props\.session\.busy/u,
  );
});

test("durable SDK requests keep GUI routes for both relative and absolute URLs", async () => {
  const urls: string[] = [];
  const http = durableChatHttp({
    origin: "",
    credentials: cookieCredentials(),
    fetch: async (url) => {
      urls.push(url);
      return Response.json({});
    },
  });
  await http.fetch("/v3/projects/project/conversations");
  await http.fetch("http://localhost:1234/v3/runs/run?after=2");
  assert.deepEqual(urls, [
    "/v1/chat/v3/projects/project/conversations",
    "http://localhost:1234/v1/chat/v3/runs/run?after=2",
  ]);
});

test("disconnect during initial discovery cannot open a chat or restart observation", async () => {
  let release!: (response: Response) => void;
  let started!: () => void;
  const fetching = new Promise<void>((resolve) => {
    started = resolve;
  });
  const urls: string[] = [];
  const client = new DurableChatClient(
    {
      origin: "",
      credentials: cookieCredentials(),
      fetch: async (url) => {
        urls.push(url);
        return new Promise<Response>((resolve) => {
          release = resolve;
          started();
        });
      },
    },
    { read: () => undefined, write() {} },
  );
  const connecting = client.connect();
  await fetching;
  client.dispose();
  release(Response.json({ models: [] }));
  await connecting;
  assert.deepEqual(urls, ["/v1/models"]);
});

test("durable global settings inspect and save are host-owned and process independent", async () => {
  const chat = {
    id: "chat",
    tenantId: "local",
    projectId: "project",
    workspaceId: "workspace-chat",
    title: "chat",
    createdAt: 1,
    updatedAt: 1,
    revision: 0,
    messages: [],
  } as const;
  const preference = (revision: string, model = "gpt-5.6-luna") => ({
    revision,
    settings: {
      instructions: "",
      budgets: { chatInputBytes: 65536 },
      semantic: { model, reasoningEffort: null },
    },
    defaults: {
      instructions: "",
      budgets: { chatInputBytes: 131072 },
      semantic: { model: "gpt-5.6-luna", reasoningEffort: null },
    },
    fields: [{
      key: "chatInputBytes",
      label: "Chat input budget",
      unit: "UTF-8 bytes",
      description: "fixture",
      minimum: 1,
      maximum: 1000000,
    }],
    storagePath: "C:/fixture/settings.json",
  });
  const calls: Array<{ path: string; method: string; body?: unknown }> = [];
  const fetch = async (input: string, init?: RequestInit) => {
    const url = new URL(input, "http://fixture");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path: url.pathname, method, ...(body === undefined ? {} : { body }) });
    if (url.pathname === "/v1/chat/v3/conversations/chat")
      return Response.json({ conversation: chat });
    if (url.pathname === "/v1/chat/v3/conversations/chat/view")
      return Response.json({
        conversation: chat,
        runs: [],
        snapshot: {
          model: DEFAULT_GUI_MODEL,
          parameters: {
            stream: true, temperature: 1, topP: 0.95, maxTokens: 2048,
            enableThinking: null, reasoningBudget: null, reasoningEffort: null,
            seed: null, stop: null,
          },
          messages: [],
          runtime: { cwd: "C:/worktree", projectId: "project", memoryPath: null },
        },
        workspace: null,
      });
    if (url.pathname === "/v1/runtime-preferences" && method === "GET")
      return Response.json(preference("r1"));
    if (url.pathname === "/v1/runtime-preferences" && method === "POST")
      return Response.json({ ...preference("r2", body.settings.semantic.model), settings: body.settings });
    throw new Error(`Unexpected request: ${method} ${url.pathname}`);
  };
  const client = new DurableChatClient(
    { origin: "http://fixture", credentials: cookieCredentials(), fetch },
    { read: () => undefined, write() {} },
    60_000,
  );
  try {
    await client.selectChat("project", "chat");
    assert.equal(
      client.getSnapshot().sessionId,
      "chat",
      `${client.getSnapshot().error ?? "no client error"}: ${JSON.stringify(calls)}`,
    );
    assert.ok(
      client.getSnapshot().details,
      `${client.getSnapshot().error ?? "no client error"}: ${JSON.stringify(calls)}`,
    );
    const inspected = await client.controlSession({ action: "inspect" });
    assert.equal(inspected.runtimePreferences?.revision, "r1");
    const saved = await client.controlSession({
      action: "configureRuntime",
      revision: "r1",
      settings: {
        ...inspected.runtimePreferences!.settings,
        semantic: { model: "gpt-6-luna", reasoningEffort: "medium" },
      },
    });
    assert.equal(saved.runtimePreferences?.revision, "r2");
    assert.equal(saved.runtimePreferences?.settings.semantic?.model, "gpt-6-luna");
    assert.deepEqual(
      calls.filter((call) => call.path === "/v1/runtime-preferences").map((call) => call.method),
      ["GET", "POST"],
    );
  } finally {
    client.dispose();
  }
});
