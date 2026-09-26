import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  bearerCredentials,
  cookieCredentials,
  engineCredentials,
  type ClientFetch,
} from "../../../packages/client/src/index.js";
import { platformRunStatusText } from "./platform-access.js";
import { createPlatformHttp } from "./platform-client.js";
import { PlatformPageView } from "./platform-page.js";
import {
  createPlatformSurface,
  type PlatformSnapshot,
} from "./platform-surface.js";

const PROJECT = "project-1";

function v2Info(profiles: readonly string[]) {
  return {
    protocol: "a008.v2",
    serverInstanceId: "server",
    serverVersion: "0.0.0",
    authProfiles: profiles,
    features: [],
    limits: {
      ticketLifetimeMs: 1,
      preauthFrameBytes: 1,
      authenticationDeadlineMs: 1,
      inputFrameBytes: 1,
      outputFrameBytes: 1,
      promptBytes: 1,
      sessionResumeLeaseMs: 1,
      commandReceiptRetentionMs: 1,
      commandReceiptLimitPerPrincipal: 1,
    },
  };
}

function conversation(revision = 0, messages: readonly unknown[] = []) {
  return {
    id: "conversation-1",
    tenantId: "local",
    projectId: PROJECT,
    workspaceId: "workspace-1",
    title: "Notes",
    createdAt: 1,
    updatedAt: 1,
    revision,
    messages,
  };
}

function run(status: string, commandId: string) {
  return {
    id: "run-1",
    tenantId: "local",
    projectId: PROJECT,
    conversationId: "conversation-1",
    workspaceId: "workspace-1",
    principalId: "owner_browser",
    commandId,
    model: "fixture-model",
    status,
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
    leaseGeneration: 0,
    effectStatus: status === "needs_reconciliation" ? "unknown" : "none",
    answerStatus: status === "succeeded" ? "completed" : status === "failed" ? "failed" : "pending",
    memoryStatus: status === "needs_reconciliation" ? "unknown" : "not_requested",
  };
}

function event(cursor: number) {
  return {
    cursor,
    tenantId: "local",
    projectId: PROJECT,
    conversationId: "conversation-1",
    runId: "run-1",
    type: "run.updated",
    resourceRevision: cursor,
    createdAt: cursor,
  };
}

interface World {
  available: boolean;
  profiles: string[];
  runStatus: string;
  createRunResult: "ok" | "conflict" | "throw";
  createRunCalls: number;
  commandId: string;
  urls: string[];
  runBodies: Array<{ commandId?: string; model?: string; text?: string }>;
  resourceHeaders: Array<Record<string, string>>;
  resourceCredentials: Array<string | undefined>;
  events: unknown[];
}

function world(): World {
  return {
    available: true,
    profiles: ["device", "browser-pin"],
    runStatus: "queued",
    createRunResult: "ok",
    createRunCalls: 0,
    commandId: "",
    urls: [],
    runBodies: [],
    resourceHeaders: [],
    resourceCredentials: [],
    events: [],
  };
}

function json(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
  };
}

function pathOf(url: string): string {
  const withoutQuery = url.split("?")[0] ?? url;
  if (withoutQuery.startsWith("http://") || withoutQuery.startsWith("https://")) {
    return new URL(withoutQuery).pathname;
  }
  return withoutQuery;
}

function worldFetch(state: World): ClientFetch {
  return async (input, init) => {
    const url = String(input);
    const path = pathOf(url);
    const method = init?.method ?? "GET";
    state.urls.push(`${method} ${path}`);
    if (path.includes("/cancel")) throw new Error("cancel was called");
    const resource =
      path.endsWith("/v1/projects") ||
      path.startsWith("/v3/projects/") ||
      path.startsWith("/v3/conversations/") ||
      path.startsWith("/v3/runs/") ||
      path === "/v3/events";
    if (resource) {
      state.resourceHeaders.push({ ...(init?.headers ?? {}) });
      state.resourceCredentials.push(init?.credentials);
    }
    if (path === "/v3/info") {
      return json(200, {
        protocolVersion: "a008.platform.v3",
        available: state.available,
        capabilities: state.available ? ["durable-runs"] : [],
      });
    }
    if (path === "/v2/info") return json(200, v2Info(state.profiles));
    if (path === "/v1/projects") {
      return json(200, {
        currentId: null,
        projects: [
          {
            projectId: PROJECT,
            name: "Fixture",
            rootFolder: "C:/fixture",
            createdAt: "2026-09-22",
            repository: { initialize: false, name: "fixture" },
            continuity: { docsFirst: false, multiAgent: { enabled: false } },
            memory: { useGlobalA008Memory: false },
          },
        ],
      });
    }
    if (method === "GET" && path === `/v3/projects/${PROJECT}/conversations`) {
      return json(200, { conversations: [conversation()] });
    }
    if (method === "POST" && path === `/v3/projects/${PROJECT}/conversations`) {
      return json(200, { conversation: conversation() });
    }
    if (method === "GET" && path === "/v3/conversations/conversation-1") {
      return json(200, {
        conversation: conversation(1, [
          {
            id: "message-1",
            role: "user",
            content: "hello",
            createdAt: 1,
            runId: "run-1",
          },
        ]),
      });
    }
    if (method === "POST" && path === "/v3/conversations/conversation-1/runs") {
      state.createRunCalls += 1;
      const body = JSON.parse(String(init?.body)) as {
        commandId?: string;
        model?: string;
        text?: string;
      };
      state.runBodies.push(body);
      state.commandId = body.commandId ?? "";
      if (state.createRunResult === "throw") throw new Error("socket closed");
      if (state.createRunResult === "conflict") {
        return json(409, {
          error: { code: "COMMAND_CONFLICT", message: "Command payload conflicts." },
        });
      }
      return json(200, { run: run(state.runStatus, state.commandId), replayed: false });
    }
    if (method === "GET" && path === "/v3/runs/run-1") {
      return json(200, { run: run(state.runStatus, state.commandId || "cmd-stable") });
    }
    if (path === "/v3/events") {
      const events = state.events;
      state.events = [];
      const last = events.at(-1) as { cursor?: number } | undefined;
      return json(200, { events, nextCursor: last?.cursor ?? 0, hasMore: false });
    }
    throw new Error(`unexpected ${method} ${path}`);
  };
}

function harness(state: World, model = "fixture-model") {
  let sleeping = false;
  let releaseSleep: (() => void) | undefined;
  const sleep = (_ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        sleeping = false;
        signal.removeEventListener("abort", onAbort);
        if (error === undefined) resolve();
        else reject(error);
      };
      const onAbort = () => finish(new Error("aborted"));
      if (signal.aborted) {
        finish(new Error("aborted"));
        return;
      }
      sleeping = true;
      releaseSleep = () => finish();
      signal.addEventListener("abort", onAbort);
    });
  const surface = createPlatformSurface({
    http: createPlatformHttp({
      fetch: worldFetch(state),
      credentials: cookieCredentials(),
      origin: "",
    }),
    model,
    createCommandId: () => "cmd-stable",
    sleep,
    pollIntervalMs: 20,
  });
  return {
    surface,
    sleeping: () => sleeping,
    release(): void {
      releaseSleep?.();
    },
  };
}

async function settle(check: () => boolean, label: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function render(snapshot: PlatformSnapshot, draft = "hello", title = "Notes"): string {
  return renderToStaticMarkup(
    createElement(PlatformPageView, {
      snapshot,
      draft,
      title,
      onDraft() {},
      onTitle() {},
      onSelectProject() {},
      onSelectConversation() {},
      onCreateConversation() {},
      onStart() {},
      onRetry() {},
    }),
  );
}

async function readySurface(state: World, model = "fixture-model") {
  const opened = harness(state, model);
  await opened.surface.activate();
  await opened.surface.selectProject(PROJECT);
  await settle(opened.sleeping, "poll wait");
  await opened.surface.createConversation("Notes");
  return opened;
}

test("run status text names every returned state", () => {
  assert.equal(platformRunStatusText("queued"), "queued");
  assert.equal(platformRunStatusText("running"), "running");
  assert.equal(platformRunStatusText("succeeded"), "completed");
  assert.equal(platformRunStatusText("cancelled"), "cancelled");
  assert.equal(platformRunStatusText("failed"), "failed");
  assert.equal(platformRunStatusText("needs_reconciliation"), "needs_reconciliation");
  assert.equal(platformRunStatusText("cancel_requested"), "cancel_requested");
});

test("unavailable info does not open resources or start a run", async () => {
  const state = world();
  state.available = false;
  const opened = harness(state);
  try {
    await opened.surface.activate();
    const snapshot = opened.surface.getSnapshot();
    assert.equal(snapshot.phase, "unavailable");
    assert.match(render(snapshot), /Platform V3 is unavailable\. No run was started\./u);
    assert.deepEqual(state.urls, ["GET /v3/info"]);
    assert.equal(state.createRunCalls, 0);
  } finally {
    opened.surface.deactivate();
  }
});

test("login is required when PIN is off and no device credential is configured", async () => {
  const state = world();
  state.profiles = ["device"];
  const opened = harness(state);
  try {
    await opened.surface.activate();
    const snapshot = opened.surface.getSnapshot();
    assert.equal(snapshot.phase, "login-required");
    assert.match(render(snapshot), /Platform resources require the existing host login\./u);
    assert.deepEqual(state.urls, ["GET /v3/info", "GET /v2/info"]);
    assert.equal(state.createRunCalls, 0);
  } finally {
    opened.surface.deactivate();
  }
});

test("PIN profile uses the cookie and does not forward an engine bearer", async () => {
  const state = world();
  const fetchImpl = worldFetch(state);
  const surface = createPlatformSurface({
    http: createPlatformHttp({
      fetch: fetchImpl,
      credentials: engineCredentials("ab".repeat(32)),
      origin: "",
    }),
    model: "fixture-model",
    createCommandId: () => "cmd-stable",
    sleep: () => new Promise(() => undefined),
  });
  try {
    await surface.activate();
    await surface.selectProject(PROJECT);
    assert.equal(surface.getSnapshot().phase, "ready");
    assert.ok(state.resourceCredentials.length > 0);
    assert.ok(state.resourceCredentials.every((value) => value === "same-origin"));
    assert.ok(
      state.resourceHeaders.every((headers) => headers.authorization === undefined),
    );
    assert.equal(JSON.stringify(surface.getSnapshot()).includes("ab".repeat(32)), false);
  } finally {
    surface.deactivate();
  }
});

test("a configured device credential is kept out of the page snapshot", async () => {
  const state = world();
  state.profiles = ["device"];
  const secret = "device-secret-token";
  const surface = createPlatformSurface({
    http: createPlatformHttp({
      fetch: worldFetch(state),
      credentials: bearerCredentials(secret),
      origin: "",
    }),
    model: "fixture-model",
    createCommandId: () => "cmd-stable",
    sleep: () => new Promise(() => undefined),
  });
  try {
    await surface.activate();
    assert.equal(surface.getSnapshot().phase, "ready");
    assert.equal(JSON.stringify(surface.getSnapshot()).includes(secret), false);
    assert.ok(state.urls.includes("GET /v1/projects"));
  } finally {
    surface.deactivate();
  }
});

test("start stays disabled without a selected model", async () => {
  const state = world();
  const opened = await readySurface(state, "");
  try {
    const snapshot = opened.surface.getSnapshot();
    assert.equal(snapshot.canStart, false);
    assert.match(render(snapshot), /No model selected\./u);
    assert.match(render(snapshot), /disabled[^>]*>Start text run/u);
    await opened.surface.startRun("hello");
    assert.equal(state.createRunCalls, 0);
  } finally {
    opened.surface.deactivate();
  }
});

test("returned run status is rendered as text and polling stops when inactive", async () => {
  const state = world();
  const opened = await readySurface(state);
  try {
    await opened.surface.startRun("hello");
    assert.equal(opened.surface.getSnapshot().runStatus, "queued");
    assert.match(render(opened.surface.getSnapshot()), /Run status: queued/u);
    const steps = [
      ["running", "running"],
      ["succeeded", "completed"],
      ["needs_reconciliation", "needs_reconciliation"],
      ["cancelled", "cancelled"],
      ["failed", "failed"],
    ] as const;
    for (const [status, text] of steps) {
      await settle(opened.sleeping, "next poll");
      state.runStatus = status;
      state.events = [event(steps.findIndex((item) => item[0] === status) + 1)];
      opened.release();
      await settle(
        () => opened.surface.getSnapshot().runStatus === text,
        text,
      );
      assert.match(render(opened.surface.getSnapshot()), new RegExp(`Run status: ${text}`, "u"));
    }
    const eventsBefore = state.urls.filter((url) => url.includes("/v3/events")).length;
    opened.surface.deactivate();
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(
      state.urls.filter((url) => url.includes("/v3/events")).length,
      eventsBefore,
    );
    assert.equal(state.urls.some((url) => url.includes("/cancel")), false);
  } finally {
    opened.surface.deactivate();
  }
});

test("conflict keeps the command id and does not retry until asked", async () => {
  const state = world();
  state.createRunResult = "conflict";
  const opened = await readySurface(state);
  try {
    await opened.surface.startRun("hello");
    assert.equal(state.createRunCalls, 1);
    const snapshot = opened.surface.getSnapshot();
    assert.equal(snapshot.attempt?.state, "conflict");
    assert.equal(snapshot.commandId, "cmd-stable");
    assert.equal(snapshot.canRetry, true);
    assert.match(render(snapshot), /Command conflict/u);
    assert.match(render(snapshot), /not replaced/u);
    assert.equal(state.runBodies[0]?.commandId, "cmd-stable");
    state.createRunResult = "ok";
    await opened.surface.retry();
    assert.equal(state.createRunCalls, 2);
    assert.equal(state.runBodies[1]?.commandId, "cmd-stable");
    assert.equal(state.runBodies[0]?.text, state.runBodies[1]?.text);
  } finally {
    opened.surface.deactivate();
  }
});

test("a failed start does not implicitly retry", async () => {
  const state = world();
  state.createRunResult = "throw";
  const opened = await readySurface(state);
  try {
    await opened.surface.startRun("hello");
    assert.equal(state.createRunCalls, 1);
    assert.equal(opened.surface.getSnapshot().attempt?.state, "failed");
    assert.equal(opened.surface.getSnapshot().commandId, "cmd-stable");
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(state.createRunCalls, 1);
    state.createRunResult = "ok";
    await opened.surface.retry();
    assert.equal(state.createRunCalls, 2);
    assert.equal(state.runBodies[1]?.commandId, "cmd-stable");
    assert.equal(state.runBodies[1]?.model, "fixture-model");
  } finally {
    opened.surface.deactivate();
  }
});

test("a second surface sees the run after the first surface is closed", async () => {
  const state = world();
  const opened = await readySurface(state);
  await opened.surface.startRun("hello");
  const runId = opened.surface.getSnapshot().runId;
  opened.surface.deactivate();
  const second = createPlatformSurface({
    http: createPlatformHttp({
      fetch: worldFetch(state),
      credentials: cookieCredentials(),
      origin: "",
    }),
    model: "fixture-model",
    createCommandId: () => "cmd-other",
    sleep: () => new Promise(() => undefined),
  });
  try {
    await second.activate();
    await second.selectProject(PROJECT);
    await second.selectConversation("conversation-1");
    const snapshot = second.getSnapshot();
    assert.equal(snapshot.runId, runId);
    assert.equal(snapshot.commandId, "cmd-stable");
    assert.equal(snapshot.runStatus, "queued");
    assert.equal(state.urls.some((url) => url.includes("/cancel")), false);
  } finally {
    second.deactivate();
  }
});

test("navigation adds Platform beside Memory, Tools and Help", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, "../app.tsx"), "utf8");
  const nav = source.slice(
    source.indexOf('aria-label="Workspace"'),
    source.indexOf("<ProjectSidebar"),
  );
  assert.ok(nav.indexOf("Memory") < nav.indexOf("Tools"));
  assert.ok(nav.indexOf("Tools") < nav.indexOf("Help"));
  assert.ok(nav.indexOf("Help") < nav.indexOf("Platform"));
  assert.match(source, /<PlatformPage/u);
  assert.match(source, /<ChatPane/u);
  const page = readFileSync(join(here, "platform-page.tsx"), "utf8");
  const surface = readFileSync(join(here, "platform-surface.ts"), "utf8");
  assert.match(page, /surface\.activate\(\)/u);
  assert.match(page, /surface\.deactivate\(\)/u);
  assert.equal(/cancelRun/u.test(page), false);
  assert.equal(/cancelRun/u.test(surface), false);
});
