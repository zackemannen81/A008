import assert from "node:assert/strict";
import { existsSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import {
  bearerCredentials,
  cookieCredentials,
  createPlatformV3Client,
  PlatformV3ClientError,
  type ClientFetch,
  type PlatformV3Client,
} from "../packages/client/src/index.js";
import { executeProjectBootstrap } from "../src/bootstrap/service.js";
import { parseProjectBootstrapConfig } from "../src/bootstrap/validate.js";
import { DEFAULT_MODEL_ID } from "../src/core/model-registry.js";
import { DeviceRegistry } from "../src/gui-host/device-registry.js";
import { startGuiHost } from "../src/gui-host/server.js";
import { PlatformStore } from "../src/platform/platform-store.js";
import type { PlatformScope } from "../src/platform/types.js";
import {
  findRepositoryRoot,
  moduleDirectory,
} from "../src/runtime/local-runtime-config.js";
import { isolatedMemoryEnv } from "./helpers.js";
import {
  spawnPlatformHost,
  startPlatformHostProcess,
} from "./fixtures/platform-host-process.js";
import { startSessionControlProvider } from "./fixtures/session-control-provider.js";
import { ProjectRuntimeRegistry } from "../src/engine/project-runtime-registry.js";
import {
  DurableChatClient,
  type ChatSelection,
} from "../gui/src/session/durable-chat-client.js";
import { killProcessTree } from "../src/tools/terminal.js";

const MODEL = DEFAULT_MODEL_ID;

test(
  "ADR 0055: history-only reads, process crash, replacement and reviewed effects preserve the durable session",
  { timeout: 90000 },
  async () => {
    const provider = await startSessionControlProvider((payload) => {
      const user = payload.messages.findLast(
        (message: { role: string }) => message.role === "user",
      );
      if (!String(user?.content).includes("Attempt dependent write"))
        return undefined;
      if (payload.messages.at(-1)?.role === "tool")
        return {
          role: "assistant",
          content: "Effect review required before writing.",
        };
      return {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "blocked-write",
            type: "function",
            function: {
              name: "create_file",
              arguments: JSON.stringify({
                path: "must-not-exist.txt",
                content: "unsafe dependency",
              }),
            },
          },
        ],
      };
    });
    const fixture = hostEnv(provider.endpoint);
    const project = bootstrap(
      fixture.env,
      fixture.directory,
      "process-lifecycle",
    );
    let host = await startGuiHost({
      env: fixture.env,
      port: 0,
      cwd: fixture.directory,
    });
    let origin = `http://127.0.0.1:${host.port}`;
    let client = new DurableChatClient(
      {
        origin,
        credentials: cookieCredentials(),
        fetch: globalThis.fetch as unknown as ClientFetch,
      },
      { read: () => undefined, write() {} },
      40,
    );
    let restartedRegistry: ProjectRuntimeRegistry | undefined;
    try {
      await client.connect();
      await client.selectChat(project.projectId, undefined, true);
      const sessionId = client.getSnapshot().sessionId!;
      const workspace = client.getWorkspace()!;
      assert.equal(workspace.sessionId, sessionId);
      assert.equal(workspace.branchName, `a008/session-${sessionId}`);
      assert.ok(workspace.baseCommit);
      assert.equal(
        client.getSnapshot().process,
        undefined,
        "opening history starts no process",
      );
      const requestsBefore = provider.requests.length;
      await client.refresh();
      assert.equal(provider.requests.length, requestsBefore);
      await client.prompt("first message");
      await waitFor(
        "first completion",
        async () => {
          await client.refresh();
          return !client.getSnapshot().busy;
        },
        25000,
      );
      const first = client.getSnapshot().process!;
      assert.equal(first.state, "running");
      await client.prompt("WAIT-TURN");
      await waitFor(
        "second run enters provider",
        async () =>
          provider.requests.some((request) =>
            JSON.stringify(request).includes("WAIT-TURN"),
          ),
        25000,
      );
      const interrupted = (
        await client.api.getConversation(sessionId)
      ).conversation.messages.at(-1)!.runId!;
      killProcessTree(first.processId);
      await waitFor(
        "process death recorded",
        async () =>
          (await client.api.getRun(interrupted)).run.status ===
          "needs_reconciliation",
        25000,
      );
      await client.refresh();
      assert.equal(client.getSnapshot().process?.state, "stopped");
      assert.equal(client.getSnapshot().process?.instanceId, first.instanceId);
      const beforeRead = provider.requests.length;
      await client.refresh();
      assert.equal(
        provider.requests.length,
        beforeRead,
        "history read never replays the interrupted turn",
      );
      await client.prompt("Attempt dependent write");
      await waitFor(
        "replacement completion",
        async () => {
          await client.refresh();
          return !client.getSnapshot().busy;
        },
        25000,
      );
      const replacement = client.getSnapshot().process!;
      assert.equal(replacement.state, "running");
      assert.notEqual(replacement.instanceId, first.instanceId);
      assert.equal(replacement.sessionId, first.sessionId);
      assert.equal(replacement.workspaceId, workspace.id);
      assert.equal(
        client.getWorkspace()?.workspacePath,
        workspace.workspacePath,
      );
      assert.equal(
        (
          await client.api.getConversation(sessionId)
        ).conversation.messages.filter(
          (message) =>
            message.role === "user" && message.content === "WAIT-TURN",
        ).length,
        1,
      );
      assert.equal(client.getSnapshot().recovery?.length, 1);
      assert.equal(
        existsSync(join(workspace.workspacePath, "must-not-exist.txt")),
        false,
        "unknown prior effects block dependent writes",
      );
      const latestRunId = (
        await client.api.getConversation(sessionId)
      ).conversation.messages.at(-1)!.runId!;
      const activity = await client.api.activityEvents(latestRunId);
      assert.ok(
        activity.events.some((event) =>
          event.changes.tools?.some((tool) => tool.status === "failed"),
        ),
      );
      assert.deepEqual(
        (await client.api.activityEvents(latestRunId, activity.nextCursor))
          .events,
        [],
      );
      await assert.rejects(
        () =>
          client.api.reviewEffects(interrupted, {
            expectedRevision: 0,
            effectsReviewed: true,
          }),
        (error: unknown) =>
          error instanceof PlatformV3ClientError &&
          error.code === "REVISION_CONFLICT",
      );
      await client.acknowledgeEffects();
      assert.equal(
        (await client.api.getRun(interrupted)).run.effectStatus,
        "known",
      );
      assert.equal(client.getSnapshot().recovery?.length, 0);
      const remembered = (await client.api.getConversation(sessionId))
        .conversation.messages;
      await client.stopProcess();
      assert.equal(client.getSnapshot().process?.state, "stopped");
      assert.deepEqual(
        (await client.api.getConversation(sessionId)).conversation.messages,
        remembered,
      );
      assert.ok(existsSync(workspace.workspacePath));
      client.dispose();
      await host.close();
      restartedRegistry = new ProjectRuntimeRegistry({ env: fixture.env });
      host = await startGuiHost({
        env: fixture.env,
        port: 0,
        cwd: fixture.directory,
        projectRegistry: restartedRegistry,
      });
      origin = `http://127.0.0.1:${host.port}`;
      client = new DurableChatClient(
        {
          origin,
          credentials: cookieCredentials(),
          fetch: globalThis.fetch as unknown as ClientFetch,
        },
        { read: () => undefined, write() {} },
        40,
      );
      await client.connect();
      await client.selectChat(project.projectId, sessionId);
      assert.deepEqual(
        (await client.api.getConversation(sessionId)).conversation.messages,
        remembered,
      );
      assert.equal(client.getSnapshot().process?.state, "stopped");
      assert.equal(
        restartedRegistry.findByProjectId(project.projectId),
        undefined,
        "history needs no semantic memory runtime",
      );
      rmSync(join(workspace.workspacePath, ".git")); // Only the test worktree's Git pointer.
      await client.refresh();
      assert.equal(client.getWorkspace(), undefined);
      assert.deepEqual(
        (await client.api.getConversation(sessionId)).conversation.messages,
        remembered,
      );
      const beforeMissing = provider.requests.length;
      const current = (await client.api.getConversation(sessionId))
        .conversation;
      const missing = await client.api.createRun(sessionId, {
        commandId: "missing-workspace",
        expectedRevision: current.revision,
        model: MODEL,
        text: "Must not execute in project root",
      });
      await waitFor(
        "missing workspace fails without execution",
        async () =>
          (await client.api.getRun(missing.run.id)).run.error?.code ===
          "WORKSPACE_MISSING",
      );
      assert.equal(provider.requests.length, beforeMissing);
    } finally {
      client.dispose();
      await host.close();
      restartedRegistry?.close();
      await provider.close();
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  },
);

test("normal durable facade preserves PIN recovery and refuses cross-origin requests before opening storage", async () => {
  const fixture = hostEnv(undefined);
  delete fixture.env.A008_PLATFORM_PATH;
  const host = await startGuiHost({
    env: fixture.env,
    pin: "123456",
    port: 0,
    cwd: fixture.directory,
  });
  try {
    const origin = `http://127.0.0.1:${host.port}`;
    assert.equal((await fetch(`${origin}/v1/chat/v3/info`)).status, 401);
    assert.equal(
      (
        await fetch(`${origin}/v1/chat/v3/info`, {
          headers: { origin: "https://untrusted.invalid" },
        })
      ).status,
      403,
    );
    assert.equal(existsSync(join(fixture.directory, "platform.sqlite")), false);
  } finally {
    await host.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test(
  "normal sidebar chats isolate tools and share runtime; navigation and disconnect leave two accepted runs alive",
  { timeout: 60_000 },
  async () => {
    const provider = await startSessionControlProvider((payload) => {
      const tool = payload.messages.findLast(
        (message: { role: string }) => message.role === "tool",
      );
      if (tool)
        return { role: "assistant", content: `Tool finished: ${tool.content}` };
      const user = payload.messages.findLast(
        (message: { role: string }) => message.role === "user",
      );
      const label = String(user.content).includes("chat-left")
        ? "left"
        : "right";
      return {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: `write-${label}`,
            type: "function",
            function: {
              name: "create_file",
              arguments: JSON.stringify({
                path: "chat-result.txt",
                content: label,
              }),
            },
          },
        ],
      };
    });
    const fixture = hostEnv(provider.endpoint, {
      A008_PLATFORM_MAX_ACTIVE_RUNS: "2",
    });
    // Exercise lazy normal-GUI storage, without an opt-in Platform page/config.
    delete fixture.env.A008_PLATFORM_PATH;
    const alpha = bootstrap(
      fixture.env,
      fixture.directory,
      "normal-alpha",
      true,
    );
    const beta = bootstrap(fixture.env, fixture.directory, "normal-beta");
    const registry = new ProjectRuntimeRegistry({ env: fixture.env });
    const host = await startGuiHost({
      env: fixture.env,
      projectRegistry: registry,
      port: 0,
      cwd: fixture.directory,
    });
    const origin = `http://127.0.0.1:${host.port}`;
    const http = {
      origin,
      credentials: cookieCredentials(),
      fetch: globalThis.fetch as unknown as ClientFetch,
    };
    let saved: ChatSelection | undefined;
    const storage = {
      read: () => saved,
      write: (selection: ChatSelection) => {
        saved = selection;
      },
    };
    const first = new DurableChatClient(http, storage, 40);
    const second = new DurableChatClient(
      http,
      { read: () => undefined, write() {} },
      40,
    );
    const observer = new DurableChatClient(http, storage, 40);
    try {
      await first.connect();
      await first.selectChat(alpha.projectId, undefined, true);
      const left = first.getSnapshot().sessionId!;
      const leftCwd = first.getSnapshot().details!.runtime.cwd;
      await first.selectChat(alpha.projectId, undefined, true);
      const right = first.getSnapshot().sessionId!;
      const rightCwd = first.getSnapshot().details!.runtime.cwd;
      await first.selectChat(alpha.projectId, undefined, true);
      const third = first.getSnapshot().sessionId!;
      const thirdCwd = first.getSnapshot().details!.runtime.cwd;
      assert.equal(new Set([leftCwd, rightCwd, thirdCwd]).size, 3);
      assert.ok(![leftCwd, rightCwd, thirdCwd].includes(alpha.rootFolder));
      assert.equal(
        (await first.sidebar()).projects.find(
          (p) => p.projectId === alpha.projectId,
        )?.conversations.length,
        3,
      );

      await first.selectChat(alpha.projectId, left);
      await second.connect();
      await second.selectChat(alpha.projectId, right);
      await Promise.all([
        first.prompt("chat-left"),
        second.prompt("chat-right"),
      ]);
      await waitFor("two simultaneous tool approvals", async () => {
        await Promise.all([first.refresh(), second.refresh()]);
        return Boolean(
          first.getSnapshot().permission && second.getSnapshot().permission,
        );
      });
      const project = registry.findByProjectId(alpha.projectId)!;
      assert.equal(
        project.agent.openSessionIds().length,
        0,
        "host owns memory; session agents execute in child processes",
      );
      assert.equal(first.getSnapshot().process?.state, "running");
      assert.equal(second.getSnapshot().process?.state, "running");
      assert.notEqual(
        first.getSnapshot().process?.processId,
        second.getSnapshot().process?.processId,
      );
      assert.notEqual(first.getSnapshot().process?.processId, process.pid);
      assert.equal(
        first.getSnapshot().details!.runtime.projectId,
        alpha.projectId,
      );
      assert.equal(
        second.getSnapshot().details!.runtime.projectId,
        alpha.projectId,
      );
      assert.equal(
        first.getSnapshot().details!.runtime.memoryPath,
        second.getSnapshot().details!.runtime.memoryPath,
      );
      assert.equal(project.binding.sqlitePath, fixture.sqlitePath);
      project.runtime.writeSharedMemory({
        content: "Shared project knowledge for both worktrees.",
      });
      assert.equal(
        JSON.parse(first.getSnapshot().permission!.text).cwd,
        leftCwd,
      );
      assert.equal(
        JSON.parse(second.getSnapshot().permission!.text).cwd,
        rightCwd,
      );
      const leftRunId = (await first.api.getConversation(left)).conversation
        .messages[0]!.runId!;
      const rightRunId = (await first.api.getConversation(right)).conversation
        .messages[0]!.runId!;
      const leftRun = (await first.api.getRun(leftRunId)).run;
      const rightRun = (await first.api.getRun(rightRunId)).run;
      assert.equal(leftRun.status, "running");
      assert.equal(rightRun.status, "running");
      assert.notEqual(leftRun.workspaceId, rightRun.workspaceId);

      await first.selectChat(alpha.projectId, third);
      await first.prompt("queued-third-chat");
      const queuedId = (await first.api.getConversation(third)).conversation
        .messages[0]!.runId!;
      assert.equal(
        (await first.api.getRun(queuedId)).run.status,
        "queued",
        "configured capacity is two",
      );
      await first.cancel();
      assert.equal((await first.api.getRun(queuedId)).run.status, "cancelled");
      await first.selectChat(beta.projectId, undefined, true);
      assert.equal((await first.api.getRun(leftRunId)).run.status, "running");
      assert.equal((await first.api.getRun(rightRunId)).run.status, "running");
      assert.equal(registry.findByProjectId(alpha.projectId), project);
      assert.equal(project.agent.openSessionIds().length, 0);
      await first.selectChat(alpha.projectId, left);
      first.dispose();
      second.dispose();
      // A fresh browser/client observes and controls pending host work after both
      // submitting clients disconnect. No websocket session owns either run.
      await observer.connect();
      assert.equal(
        observer.getSnapshot().sessionId,
        left,
        "refresh restores this tab's selected durable conversation",
      );
      assert.equal(observer.getSnapshot().details!.runtime.cwd, leftCwd);
      assert.ok(observer.getSnapshot().permission);
      observer.resolveToolPermission("allow_once");
      await waitFor(
        "left durable completion",
        async () =>
          (await observer.api.getRun(leftRunId)).run.status === "succeeded",
      );
      await observer.selectChat(alpha.projectId, right);
      assert.equal(observer.getSnapshot().details!.runtime.cwd, rightCwd);
      observer.resolveToolPermission("allow_once");
      await waitFor(
        "right durable completion",
        async () =>
          (await observer.api.getRun(rightRunId)).run.status === "succeeded",
      );
      assert.equal(
        readFileSync(join(leftCwd, "chat-result.txt"), "utf8"),
        "left",
      );
      assert.equal(
        readFileSync(join(rightCwd, "chat-result.txt"), "utf8"),
        "right",
      );
      assert.equal(
        existsSync(join(alpha.rootFolder, "chat-result.txt")),
        false,
      );
      assert.equal(existsSync(join(thirdCwd, "chat-result.txt")), false);
      assert.equal(
        (await observer.api.getRun(leftRunId)).run.workspaceId,
        leftRun.workspaceId,
      );
      assert.equal(
        (await observer.api.getConversation(right)).conversation.messages
          .length,
        2,
      );
      assert.equal(registry.findByProjectId(alpha.projectId), project);
      assert.equal(
        project.agent.openSessionIds().length,
        0,
        "finished tool sessions release without closing shared memory",
      );
      assert.ok(
        project.runtime
          .inspectMemory({})
          .records.some((record) =>
            record.detail.includes("Shared project knowledge"),
          ),
      );
    } finally {
      first.dispose();
      second.dispose();
      observer.dispose();
      await host.close();
      registry.close();
      await provider.close();
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  },
);

function limits(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    A008_PLATFORM_SCAN_MS: "40",
    A008_PLATFORM_LEASE_MS: "4000",
    A008_PLATFORM_RENEW_MS: "400",
    A008_PLATFORM_TURN_TIMEOUT_MS: "20000",
    A008_PLATFORM_SHUTDOWN_DRAIN_MS: "4000",
    ...extra,
  };
}

function hostEnv(endpoint: string | undefined, extra: NodeJS.ProcessEnv = {}) {
  const fixture = isolatedMemoryEnv({
    ...(endpoint === undefined
      ? {}
      : { NVIDIA_CHAT_COMPLETIONS_URL: endpoint }),
    ...limits(extra),
  });
  fixture.env.PATH = process.env.PATH;
  fixture.env.A008_DEVICES_PATH = join(fixture.directory, "devices.sqlite");
  fixture.env.A008_PROJECTS_PATH = join(fixture.directory, "projects.json");
  fixture.env.A008_CATALOG_PATH = join(fixture.directory, "catalog.json");
  fixture.env.A008_SECRETS_PATH = join(fixture.directory, "secrets.json");
  fixture.env.A008_PLATFORM_PATH = join(fixture.directory, "platform.sqlite");
  return fixture;
}

function childEnv(fixture: ReturnType<typeof hostEnv>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...fixture.env,
    NVIDIA_API_KEY: "test-token",
    A008_SECRETS_PATH: fixture.env.A008_SECRETS_PATH,
    A008_CATALOG_PATH: fixture.env.A008_CATALOG_PATH,
    A008_DEVICES_PATH: fixture.env.A008_DEVICES_PATH,
    A008_PROJECTS_PATH: fixture.env.A008_PROJECTS_PATH,
    A008_PLATFORM_PATH: fixture.env.A008_PLATFORM_PATH,
    A008_MEMORY_SQLITE_PATH: fixture.sqlitePath,
    A008_SETTINGS_PATH: fixture.env.A008_SETTINGS_PATH,
  };
}

function bootstrap(
  env: NodeJS.ProcessEnv,
  directory: string,
  name: string,
  useGlobalMemory = false,
) {
  const project = executeProjectBootstrap(
    parseProjectBootstrapConfig({
      projectName: name,
      rootFolder: join(directory, name),
      repository: { initialize: true },
      continuity: { docsFirst: false, multiAgent: { enabled: false } },
      memory: { useGlobalA008Memory: useGlobalMemory },
    }),
    { registryPath: env.A008_PROJECTS_PATH ?? "" },
  ).project;
  writeFileSync(join(project.rootFolder, ".gitkeep"), "seed", "utf8");
  for (const args of [
    ["add", ".gitkeep"],
    [
      "-c",
      "user.name=A008",
      "-c",
      "user.email=a008@example.invalid",
      "commit",
      "-m",
      "initial",
    ],
  ]) {
    const result = spawnSync("git", args, {
      cwd: project.rootFolder,
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0)
      throw new Error(result.stderr || "git setup failed");
  }
  return project;
}

function grant(
  env: NodeJS.ProcessEnv,
  projectIds: readonly string[],
  capabilities: Array<"session" | "memory"> = ["session"],
) {
  return new DeviceRegistry(env).grant({
    name: "platform-test",
    projects: [...projectIds],
    capabilities,
  });
}

function requiredPlatformPath(env: NodeJS.ProcessEnv): string {
  const path = env.A008_PLATFORM_PATH;
  if (path === undefined || path.length === 0) {
    throw new Error("missing platform path");
  }
  return path;
}

function sdk(port: number, credential: string): PlatformV3Client {
  return createPlatformV3Client({
    origin: `http://127.0.0.1:${String(port)}`,
    credentials: bearerCredentials(credential),
    fetch: globalThis.fetch as unknown as ClientFetch,
  });
}

async function waitFor(
  label: string,
  check: () => Promise<boolean>,
  timeoutMs = 12_000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function operationOf(payload: Record<string, any>): string | undefined {
  const content = payload.messages?.at(-1)?.content;
  if (typeof content !== "string") return undefined;
  try {
    const parsed = JSON.parse(content) as { readonly operation?: unknown };
    return typeof parsed.operation === "string" ? parsed.operation : undefined;
  } catch {
    return undefined;
  }
}

function providerUserText(content: unknown): string | undefined {
  if (typeof content !== "string") return undefined;
  try {
    const parsed = JSON.parse(content) as { readonly message?: unknown };
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    /* raw chat text */
  }
  return content;
}

function chatCount(
  requests: readonly Record<string, any>[],
  prompt: string,
): number {
  return requests.filter((payload) => {
    if (operationOf(payload) !== undefined) return false;
    return providerUserText(payload.messages?.at(-1)?.content) === prompt;
  }).length;
}

async function expectPlatformError(
  work: () => Promise<unknown>,
  status: number,
  code: string,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    assert.ok(error instanceof PlatformV3ClientError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return;
  }
  assert.fail(`Expected ${code}`);
}

test("platform stays unavailable until opted in and rejects unsafe paths", async () => {
  const absent = hostEnv(undefined);
  delete absent.env.A008_PLATFORM_PATH;
  const host = await startGuiHost({
    env: absent.env,
    port: 0,
    cwd: absent.directory,
  });
  try {
    const info = (await (
      await fetch(`http://127.0.0.1:${String(host.port)}/v3/info`)
    ).json()) as {
      available: boolean;
      capabilities: string[];
      protocolVersion: string;
    };
    assert.equal(info.protocolVersion, "a008.platform.v3");
    assert.equal(info.available, false);
    assert.deepEqual(info.capabilities, []);
    const health = await fetch(`http://127.0.0.1:${String(host.port)}/health`);
    assert.equal(health.status, 200);
    const hidden = await fetch(
      `http://127.0.0.1:${String(host.port)}/v3/projects/missing/conversations`,
    );
    assert.equal(hidden.status, 404);
    assert.equal(existsSync(join(absent.directory, "platform.sqlite")), false);
  } finally {
    await host.close();
    rmSync(absent.directory, { recursive: true, force: true });
  }

  const relative = hostEnv(undefined);
  await assert.rejects(
    () =>
      startGuiHost({
        env: relative.env,
        port: 0,
        cwd: relative.directory,
        platformPath: "platform.sqlite",
      }),
    /absolute file path/u,
  );
  assert.equal(existsSync(join(relative.directory, "platform.sqlite")), false);
  rmSync(relative.directory, { recursive: true, force: true });

  const inside = hostEnv(undefined);
  const repoRoot = findRepositoryRoot(moduleDirectory(import.meta.url));
  await assert.rejects(
    () =>
      startGuiHost({
        env: inside.env,
        port: 0,
        cwd: inside.directory,
        platformPath: join(repoRoot, "platform.sqlite"),
      }),
    /outside the A008 repository/u,
  );
  rmSync(inside.directory, { recursive: true, force: true });

  const sameMemory = hostEnv(undefined);
  await assert.rejects(
    () =>
      startGuiHost({
        env: sameMemory.env,
        port: 0,
        cwd: sameMemory.directory,
        platformPath: sameMemory.sqlitePath,
      }),
    /distinct from semantic memory/u,
  );
  rmSync(sameMemory.directory, { recursive: true, force: true });
});

test(
  "authenticated platform HTTP accepts once and preserves conflicts",
  { timeout: 40_000 },
  async () => {
    const provider = await startSessionControlProvider();
    const fixture = hostEnv(provider.endpoint);
    const project = bootstrap(fixture.env, fixture.directory, "alpha");
    const other = bootstrap(fixture.env, fixture.directory, "beta");
    const allowed = grant(fixture.env, [project.projectId]);
    const foreign = grant(fixture.env, [other.projectId]);
    const memoryOnly = grant(fixture.env, [project.projectId], ["memory"]);
    const host = await startGuiHost({
      env: fixture.env,
      port: 0,
      cwd: fixture.directory,
      platformPath: requiredPlatformPath(fixture.env),
    });
    const client = sdk(host.port, allowed.credential);
    const outsider = sdk(host.port, foreign.credential);
    try {
      const origin = `http://127.0.0.1:${String(host.port)}`;
      const infoResponse = await fetch(`${origin}/v3/info`);
      const info = (await infoResponse.json()) as {
        available: boolean;
        capabilities: string[];
      };
      assert.equal(info.available, true);
      assert.deepEqual(info.capabilities, [
        "durable-conversations",
        "durable-runs",
        "command-receipts",
        "event-polling",
        "background-text-runs",
        "restart-uncertainty",
      ]);
      assert.equal(JSON.stringify(info).includes("platform.sqlite"), false);
      assert.equal(JSON.stringify(info).includes(fixture.directory), false);
      const cross = await fetch(`${origin}/v3/info`, {
        headers: { origin: "https://evil.example" },
      });
      assert.equal(cross.status, 403);

      const anonymous = await fetch(
        `${origin}/v3/conversations/A008_v1_conversation_00000000-0000-4000-8000-000000000099`,
      );
      assert.equal(anonymous.status, 401);
      await expectPlatformError(
        () => outsider.listConversations(project.projectId),
        404,
        "NOT_FOUND",
      );
      await expectPlatformError(
        () =>
          sdk(host.port, memoryOnly.credential).listConversations(
            project.projectId,
          ),
        403,
        "FORBIDDEN",
      );

      const created = await client.createConversation(project.projectId, {
        title: "Investigate",
      });
      const conversationId = created.conversation.id;
      assert.equal(created.conversation.tenantId, "local");
      assert.equal(created.conversation.messages.length, 0);
      await expectPlatformError(
        () => outsider.getConversation(conversationId),
        404,
        "NOT_FOUND",
      );

      const prompt = "Summarize the plan.";
      const [first, replay] = await Promise.all([
        client.createRun(conversationId, {
          commandId: "accept-once",
          expectedRevision: 0,
          model: MODEL,
          text: prompt,
        }),
        client.createRun(conversationId, {
          commandId: "accept-once",
          expectedRevision: 0,
          model: MODEL,
          text: prompt,
        }),
      ]);
      assert.equal(first.run.id, replay.run.id);
      assert.equal(first.replayed || replay.replayed, true);
      await waitFor("accepted run", async () => {
        const current = await client.getRun(first.run.id);
        return (
          current.run.status === "succeeded" &&
          current.run.answerStatus === "completed"
        );
      });
      assert.equal(chatCount(provider.requests, prompt), 1);
      const done = await client.getRun(first.run.id);
      assert.equal(done.run.answerStatus, "completed");
      assert.notEqual(done.run.memoryStatus, "pending");
      const history = await client.getConversation(conversationId);
      assert.deepEqual(
        history.conversation.messages.map((message) => message.role),
        ["user", "assistant"],
      );
      assert.equal(history.conversation.messages[0]?.content, prompt);
      assert.equal(typeof history.conversation.messages[1]?.content, "string");
      assert.match(
        String(history.conversation.messages[1]?.content),
        /Fixture answer/u,
      );
      assert.equal(
        String(history.conversation.messages[1]?.content).includes(
          "Display-only",
        ),
        false,
      );
      const chat = provider.requests.find(
        (payload) =>
          operationOf(payload) === undefined &&
          providerUserText(payload.messages?.at(-1)?.content) === prompt,
      );
      assert.ok(chat !== undefined);
      assert.equal(chat.tools, undefined);

      const events = await client.events({
        projectId: project.projectId,
        limit: 100,
      });
      assert.ok(events.events.some((event) => event.type === "run.queued"));
      assert.ok(
        events.events.some((event) => event.type === "conversation.updated"),
      );
      const page = await client.events({
        projectId: project.projectId,
        after: events.events[0]?.cursor ?? 0,
        limit: 1,
      });
      assert.equal(page.events.length <= 1, true);

      await expectPlatformError(
        () =>
          client.createRun(conversationId, {
            commandId: "accept-once",
            expectedRevision: 99,
            model: MODEL,
            text: "different",
          }),
        409,
        "COMMAND_CONFLICT",
      );
      assert.equal(
        (await client.getConversation(conversationId)).conversation.messages
          .length,
        2,
      );

      const second = await client.createConversation(project.projectId, {
        title: "Race",
      });
      const raced = await Promise.allSettled([
        client.createRun(second.conversation.id, {
          commandId: "race-a",
          expectedRevision: 0,
          model: MODEL,
          text: "race a",
        }),
        client.createRun(second.conversation.id, {
          commandId: "race-b",
          expectedRevision: 0,
          model: MODEL,
          text: "race b",
        }),
      ]);
      const fulfilled = raced.filter((result) => result.status === "fulfilled");
      const rejected = raced.filter((result) => result.status === "rejected");
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      const failure = rejected[0];
      assert.ok(failure?.status === "rejected");
      assert.ok(failure.reason instanceof PlatformV3ClientError);
      assert.equal(failure.reason.code, "REVISION_CONFLICT");
      const racedMessages = (
        await client.getConversation(second.conversation.id)
      ).conversation.messages;
      assert.equal(
        racedMessages.filter((message) => message.role === "user").length,
        1,
      );

      await expectPlatformError(
        () =>
          client.createRun(conversationId, {
            commandId: "unknown-model",
            expectedRevision: history.conversation.revision,
            model: "not-a-registered-model",
            text: "no",
          }),
        400,
        "INVALID_REQUEST",
      );
      const oversized = await fetch(
        `${origin}/v3/conversations/${encodeURIComponent(conversationId)}/runs`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${allowed.credential}`,
          },
          body: JSON.stringify({
            commandId: "too-long",
            expectedRevision: 1,
            model: MODEL,
            text: "x".repeat(65_537),
          }),
        },
      );
      assert.equal(oversized.status, 400);
      const wide = "😀".repeat(20_000);
      const wideResponse = await fetch(
        `${origin}/v3/conversations/${encodeURIComponent(conversationId)}/runs`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${allowed.credential}`,
          },
          body: JSON.stringify({
            commandId: "too-wide",
            expectedRevision: 1,
            model: MODEL,
            text: wide,
          }),
        },
      );
      assert.equal(wideResponse.status, 400);
      const huge = await fetch(
        `${origin}/v3/projects/${encodeURIComponent(project.projectId)}/conversations`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${allowed.credential}`,
          },
          body: `{"title":"${"y".repeat(1_048_576)}"}`,
        },
      );
      assert.equal(huge.status, 400);
      const controller = new AbortController();
      const pendingEvents = client.events(
        { projectId: project.projectId },
        controller.signal,
      );
      controller.abort();
      await pendingEvents.catch(() => undefined);
      assert.equal((await client.getRun(first.run.id)).run.status, "succeeded");
    } finally {
      await host.close();
      await provider.close();
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  },
);

test(
  "projects and conversations run concurrently and keep seeded history singular",
  { timeout: 40_000 },
  async () => {
    const provider = await startSessionControlProvider();
    const fixture = hostEnv(provider.endpoint);
    const alpha = bootstrap(fixture.env, fixture.directory, "alpha");
    const beta = bootstrap(fixture.env, fixture.directory, "beta");
    const credential = grant(fixture.env, [alpha.projectId, beta.projectId]);
    const host = await startGuiHost({
      env: fixture.env,
      port: 0,
      cwd: fixture.directory,
    });
    const client = sdk(host.port, credential.credential);
    try {
      const left = await client.createConversation(alpha.projectId, {
        title: "Left",
      });
      const right = await client.createConversation(beta.projectId, {
        title: "Right",
      });
      const same = await client.createConversation(alpha.projectId, {
        title: "Same",
      });
      const prompts = [
        "DELAY-ANSWER alpha",
        "DELAY-ANSWER beta",
        "DELAY-ANSWER same",
      ];
      await Promise.all([
        client.createRun(left.conversation.id, {
          commandId: "left",
          expectedRevision: 0,
          model: MODEL,
          text: prompts[0]!,
        }),
        client.createRun(right.conversation.id, {
          commandId: "right",
          expectedRevision: 0,
          model: MODEL,
          text: prompts[1]!,
        }),
        client.createRun(same.conversation.id, {
          commandId: "same",
          expectedRevision: 0,
          model: MODEL,
          text: prompts[2]!,
        }),
      ]);
      await waitFor("three answers", async () => {
        const runs = await Promise.all([
          client.getConversation(left.conversation.id),
          client.getConversation(right.conversation.id),
          client.getConversation(same.conversation.id),
        ]);
        return runs.every((item) =>
          item.conversation.messages.some(
            (message) => message.role === "assistant",
          ),
        );
      });
      assert.ok(provider.peakChatInFlight() >= 2);
      for (const prompt of prompts)
        assert.equal(chatCount(provider.requests, prompt), 1);

      const follow = await client.getConversation(left.conversation.id);
      const followPrompt = "What changed?";
      const followed = await client.createRun(left.conversation.id, {
        commandId: "follow",
        expectedRevision: follow.conversation.revision,
        model: MODEL,
        text: followPrompt,
      });
      await waitFor(
        "follow-up",
        async () =>
          (await client.getRun(followed.run.id)).run.status === "succeeded",
      );
      const seeded = provider.requests.find(
        (payload) =>
          operationOf(payload) === undefined &&
          providerUserText(payload.messages?.at(-1)?.content) === followPrompt,
      );
      const contents = (seeded?.messages ?? []).map(
        (message: { content?: unknown }) => providerUserText(message.content),
      );
      assert.equal(
        contents.filter((content: string | undefined) => content === prompts[0])
          .length,
        1,
      );
      assert.equal(contents.at(-1), followPrompt);
      assert.equal(chatCount(provider.requests, prompts[0]!), 1);
    } finally {
      await host.close();
      await provider.close();
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  },
);

test(
  "cancellation, memory failure, and known provider failure stay distinct",
  { timeout: 50_000 },
  async () => {
    const provider = await startSessionControlProvider();
    const queuedFixture = hostEnv(provider.endpoint, {
      A008_PLATFORM_MAX_ACTIVE_RUNS: "1",
      A008_PLATFORM_MAX_NONTERMINAL_PER_PROJECT: "2",
      A008_PLATFORM_MAX_NONTERMINAL: "2",
      A008_PLATFORM_TURN_TIMEOUT_MS: "30000",
    });
    const queuedProject = bootstrap(
      queuedFixture.env,
      queuedFixture.directory,
      "alpha",
    );
    const queuedGrant = grant(queuedFixture.env, [queuedProject.projectId]);
    const queuedHost = await startGuiHost({
      env: queuedFixture.env,
      port: 0,
      cwd: queuedFixture.directory,
    });
    const queuedClient = sdk(queuedHost.port, queuedGrant.credential);
    try {
      const held = await queuedClient.createConversation(
        queuedProject.projectId,
        { title: "Hold" },
      );
      const next = await queuedClient.createConversation(
        queuedProject.projectId,
        { title: "Queue" },
      );
      const holding = await queuedClient.createRun(held.conversation.id, {
        commandId: "hold",
        expectedRevision: 0,
        model: MODEL,
        text: "slot WAIT-TURN",
      });
      await waitFor(
        "slot claimed",
        async () =>
          (await queuedClient.getRun(holding.run.id)).run.effectStatus ===
          "unknown",
      );
      await expectPlatformError(
        () =>
          queuedClient.createRun(held.conversation.id, {
            commandId: "busy",
            expectedRevision: 1,
            model: MODEL,
            text: "second writer",
          }),
        409,
        "CONVERSATION_BUSY",
      );
      assert.equal(
        (await queuedClient.getConversation(held.conversation.id)).conversation
          .messages.length,
        1,
      );
      const waiting = await queuedClient.createRun(next.conversation.id, {
        commandId: "queued-cancel",
        expectedRevision: 0,
        model: MODEL,
        text: "cancel before dispatch",
      });
      const overflow = await queuedClient.createConversation(
        queuedProject.projectId,
        {
          title: "Overflow",
        },
      );
      await expectPlatformError(
        () =>
          queuedClient.createRun(overflow.conversation.id, {
            commandId: "over-capacity",
            expectedRevision: 0,
            model: MODEL,
            text: "no room",
          }),
        429,
        "CAPACITY_EXCEEDED",
      );
      const cancelled = await queuedClient.cancelRun(waiting.run.id, {
        expectedRevision: waiting.run.revision,
      });
      assert.equal(cancelled.run.status, "cancelled");
      assert.equal(chatCount(provider.requests, "cancel before dispatch"), 0);
      const replay = await queuedClient.createRun(held.conversation.id, {
        commandId: "hold",
        expectedRevision: 0,
        model: MODEL,
        text: "slot WAIT-TURN",
      });
      assert.equal(replay.replayed, true);
      assert.equal(replay.run.id, holding.run.id);
      assert.equal(chatCount(provider.requests, "no room"), 0);
    } finally {
      await queuedHost.close();
      rmSync(queuedFixture.directory, { recursive: true, force: true });
    }

    const fixture = hostEnv(provider.endpoint, {
      A008_PLATFORM_LEASE_MS: "500",
      A008_PLATFORM_RENEW_MS: "80",
      A008_PLATFORM_TURN_TIMEOUT_MS: "30000",
    });
    const project = bootstrap(fixture.env, fixture.directory, "alpha");
    const credential = grant(fixture.env, [project.projectId]);
    const host = await startGuiHost({
      env: fixture.env,
      port: 0,
      cwd: fixture.directory,
    });
    const client = sdk(host.port, credential.credential);
    try {
      const answerChat = await client.createConversation(project.projectId, {
        title: "Answer",
      });
      const delayed = await client.createRun(answerChat.conversation.id, {
        commandId: "delay",
        expectedRevision: 0,
        model: MODEL,
        text: "DELAY-ANSWER please",
      });
      await waitFor(
        "delayed run enters provider",
        async () => chatCount(provider.requests, "DELAY-ANSWER please") === 1,
      );
      const current = await client.getRun(delayed.run.id);
      await client.cancelRun(delayed.run.id, {
        expectedRevision: current.run.revision,
      });
      await waitFor(
        "cancelled process leaves uncertain effects fenced",
        async () =>
          (await client.getRun(delayed.run.id)).run.status ===
          "needs_reconciliation",
      );
      const answered = await client.getRun(delayed.run.id);
      assert.notEqual(answered.run.answerStatus, "completed");
      assert.notEqual(answered.run.status, "cancelled");
      assert.equal(chatCount(provider.requests, "DELAY-ANSWER please"), 1);

      const memoryChat = await client.createConversation(project.projectId, {
        title: "Memory",
      });
      const memory = await client.createRun(memoryChat.conversation.id, {
        commandId: "memory",
        expectedRevision: 0,
        model: MODEL,
        text: "MEMORY-FAIL the intake",
      });
      await waitFor("memory separated", async () => {
        const currentRun = await client.getRun(memory.run.id);
        return (
          currentRun.run.answerStatus === "completed" &&
          currentRun.run.memoryStatus === "failed"
        );
      });
      assert.equal(
        (await client.getRun(memory.run.id)).run.status,
        "succeeded",
      );
      const memoryCalls = chatCount(
        provider.requests,
        "MEMORY-FAIL the intake",
      );
      assert.equal(memoryCalls, 1);
      await new Promise((resolve) => setTimeout(resolve, 250));
      assert.equal(
        chatCount(provider.requests, "MEMORY-FAIL the intake"),
        memoryCalls,
      );

      const failedChat = await client.createConversation(project.projectId, {
        title: "Fail",
      });
      const failed = await client.createRun(failedChat.conversation.id, {
        commandId: "fail",
        expectedRevision: 0,
        model: MODEL,
        text: "FAIL-TURN now",
      });
      await waitFor(
        "known provider failure is terminal",
        async () => (await client.getRun(failed.run.id)).run.status === "failed",
      );
      const terminal = await client.getRun(failed.run.id);
      assert.equal(terminal.run.effectStatus, "known");
      assert.equal(terminal.run.answerStatus, "failed");
      assert.equal(terminal.run.error?.code, "SESSION_RUN_FAILED");
      assert.match(
        terminal.run.error?.message ?? "",
        /provider was unavailable|MODEL_UNAVAILABLE/u,
      );
      assert.equal(chatCount(provider.requests, "FAIL-TURN now"), 1);
    } finally {
      await host.close();
      await provider.close();
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  },
);

test(
  "revocation before dispatch does not start queued work",
  { timeout: 30_000 },
  async () => {
    const provider = await startSessionControlProvider();
    const fixture = hostEnv(provider.endpoint, {
      A008_PLATFORM_MAX_ACTIVE_RUNS: "1",
      A008_PLATFORM_LEASE_MS: "400",
      A008_PLATFORM_RENEW_MS: "50",
      A008_PLATFORM_TURN_TIMEOUT_MS: "30000",
    });
    const project = bootstrap(fixture.env, fixture.directory, "alpha");
    const credential = grant(fixture.env, [project.projectId]);
    const host = await startGuiHost({
      env: fixture.env,
      port: 0,
      cwd: fixture.directory,
    });
    const client = sdk(host.port, credential.credential);
    try {
      const first = await client.createConversation(project.projectId, {
        title: "First",
      });
      const second = await client.createConversation(project.projectId, {
        title: "Second",
      });
      const held = await client.createRun(first.conversation.id, {
        commandId: "held",
        expectedRevision: 0,
        model: MODEL,
        text: "revoke WAIT-TURN",
      });
      await waitFor(
        "held dispatched to provider",
        async () => chatCount(provider.requests, "revoke WAIT-TURN") === 1,
      );
      const queued = await client.createRun(second.conversation.id, {
        commandId: "queued",
        expectedRevision: 0,
        model: MODEL,
        text: "must stay queued",
      });
      assert.equal(queued.run.status, "queued");
      assert.equal(
        new DeviceRegistry(fixture.env).revoke(credential.device.id),
        true,
      );
      const scope: PlatformScope = {
        tenantId: "local",
        projectId: project.projectId,
        principalId: credential.device.id,
      };
      await waitFor("held fenced after revocation", async () => {
        const store = new PlatformStore({
          filename: requiredPlatformPath(fixture.env),
        });
        try {
          return (
            store.getRun(scope, held.run.id).status === "needs_reconciliation"
          );
        } finally {
          store.close();
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      const after = new PlatformStore({
        filename: requiredPlatformPath(fixture.env),
      });
      try {
        assert.equal(after.getRun(scope, queued.run.id).status, "queued");
      } finally {
        after.close();
      }
      assert.equal(chatCount(provider.requests, "revoke WAIT-TURN"), 1);
      assert.equal(chatCount(provider.requests, "must stay queued"), 0);
    } finally {
      await host.close();
      await provider.close();
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  },
);

test(
  "response snapshots over the ceiling are refused whole",
  { timeout: 20_000 },
  async () => {
    const provider = await startSessionControlProvider();
    const fixture = hostEnv(provider.endpoint, {
      A008_PLATFORM_MAX_RESPONSE_BYTES: "700",
    });
    const project = bootstrap(fixture.env, fixture.directory, "alpha");
    const credential = grant(fixture.env, [project.projectId]);
    const host = await startGuiHost({
      env: fixture.env,
      port: 0,
      cwd: fixture.directory,
    });
    const client = sdk(host.port, credential.credential);
    try {
      const created = await client.createConversation(project.projectId, {
        title: "Small",
      });
      const accepted = await client.createRun(created.conversation.id, {
        commandId: "wide-snapshot",
        expectedRevision: 0,
        model: MODEL,
        text: "x".repeat(500),
      });
      await expectPlatformError(
        () => client.getConversation(created.conversation.id),
        429,
        "CAPACITY_EXCEEDED",
      );
      const run = await client.getRun(accepted.run.id);
      assert.equal(run.run.commandId, "wide-snapshot");
    } finally {
      await host.close();
      await provider.close();
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  },
);

test(
  "pending post-output memory becomes unknown without another provider call",
  { timeout: 20_000 },
  async () => {
    const provider = await startSessionControlProvider();
    const fixture = hostEnv(provider.endpoint, { A008_PLATFORM_SCAN_MS: "40" });
    const project = bootstrap(fixture.env, fixture.directory, "alpha");
    const credential = grant(fixture.env, [project.projectId]);
    const scope: PlatformScope = {
      tenantId: "local",
      projectId: project.projectId,
      principalId: credential.device.id,
    };
    const store = new PlatformStore({
      filename: fixture.env.A008_PLATFORM_PATH ?? "",
    });
    const conversation = store.createConversation(scope, {
      title: "Recovered",
    });
    const accepted = store.acceptRun(scope, {
      conversationId: conversation.id,
      commandId: "already-answered",
      expectedRevision: 0,
      model: MODEL,
      text: "do not call the provider",
      memoryRequested: true,
    });
    const claimed = store.claimRun(scope, {
      runId: accepted.run.id,
      ownerToken: "previous-process",
      leaseDurationMs: 30_000,
    });
    const dispatched = store.recordDispatch(scope, {
      runId: claimed.run.id,
      ownerToken: claimed.lease.ownerToken,
      generation: claimed.lease.generation,
      expectedRevision: claimed.run.revision,
    });
    const committed = store.commitAnswer(scope, {
      runId: dispatched.id,
      ownerToken: claimed.lease.ownerToken,
      generation: claimed.lease.generation,
      expectedRevision: dispatched.revision,
      content: "persisted before the crash",
    });
    assert.equal(committed.memoryStatus, "pending");
    assert.equal(committed.answerStatus, "completed");
    store.close();
    const host = await startGuiHost({
      env: fixture.env,
      port: 0,
      cwd: fixture.directory,
    });
    const client = sdk(host.port, credential.credential);
    try {
      await waitFor(
        "memory marked unknown",
        async () =>
          (await client.getRun(committed.id)).run.memoryStatus === "unknown",
      );
      const recovered = await client.getRun(committed.id);
      assert.equal(recovered.run.status, "succeeded");
      assert.equal(recovered.run.answerStatus, "completed");
      assert.equal(provider.requests.length, 0);
      const history = await client.getConversation(conversation.id);
      assert.equal(
        history.conversation.messages.at(-1)?.content,
        "persisted before the crash",
      );
    } finally {
      await host.close();
      await provider.close();
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  },
);

test(
  "a model bearer is not platform authentication and PIN dispatch follows the PIN profile",
  { timeout: 30_000 },
  async () => {
    const provider = await startSessionControlProvider();
    const fixture = hostEnv(provider.endpoint);
    const project = bootstrap(fixture.env, fixture.directory, "alpha");
    const credential = grant(fixture.env, [project.projectId]);
    const token = "a".repeat(64);
    const locked = await startGuiHost({
      env: fixture.env,
      port: 0,
      cwd: fixture.directory,
      accessToken: token,
      platformPath: requiredPlatformPath(fixture.env),
    });
    try {
      const origin = `http://127.0.0.1:${String(locked.port)}`;
      const info = (await (await fetch(`${origin}/v3/info`)).json()) as {
        available: boolean;
      };
      assert.equal(info.available, true);
      const denied = await fetch(
        `${origin}/v3/projects/${encodeURIComponent(project.projectId)}/conversations`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      assert.equal(denied.status, 401);
      const client = sdk(locked.port, credential.credential);
      const created = await client.createConversation(project.projectId, {
        title: "Device",
      });
      assert.equal(created.conversation.projectId, project.projectId);
    } finally {
      await locked.close();
    }

    const pinFixture = hostEnv(provider.endpoint, {
      A008_PLATFORM_MAX_ACTIVE_RUNS: "1",
      A008_PLATFORM_LEASE_MS: "400",
      A008_PLATFORM_RENEW_MS: "50",
      A008_PLATFORM_TURN_TIMEOUT_MS: "30000",
    });
    const pinProject = bootstrap(pinFixture.env, pinFixture.directory, "pin");
    const withPin = await startGuiHost({
      env: pinFixture.env,
      port: 0,
      cwd: pinFixture.directory,
      pin: "135790",
      platformPath: requiredPlatformPath(pinFixture.env),
    });
    const pinOrigin = `http://127.0.0.1:${String(withPin.port)}`;
    const login = await fetch(`${pinOrigin}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin: "135790" }),
    });
    assert.equal(login.status, 200);
    const cookie =
      (login.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "";
    const pinClient = createPlatformV3Client({
      origin: pinOrigin,
      credentials: {
        kind: "cookie",
        headers: () => ({ cookie }),
        applySocketUrl: (url) => url,
        fetchCredentials: () => "omit",
      },
      fetch: globalThis.fetch as unknown as ClientFetch,
    });
    const pinConversation = await pinClient.createConversation(
      pinProject.projectId,
      {
        title: "Owner",
      },
    );
    const held = await pinClient.createRun(pinConversation.conversation.id, {
      commandId: "pin-hold",
      expectedRevision: 0,
      model: MODEL,
      text: "pin WAIT-TURN",
    });
    await waitFor(
      "pin slot",
      async () =>
        (await pinClient.getRun(held.run.id)).run.effectStatus === "unknown",
    );
    const secondConversation = await pinClient.createConversation(
      pinProject.projectId,
      {
        title: "Later",
      },
    );
    const queued = await pinClient.createRun(
      secondConversation.conversation.id,
      {
        commandId: "pin-queued",
        expectedRevision: 0,
        model: MODEL,
        text: "pin queued work",
      },
    );
    assert.equal(queued.run.status, "queued");
    await withPin.close();

    const withoutPin = await startGuiHost({
      env: pinFixture.env,
      port: 0,
      cwd: pinFixture.directory,
      platformPath: requiredPlatformPath(pinFixture.env),
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const store = new PlatformStore({
        filename: pinFixture.env.A008_PLATFORM_PATH ?? "",
      });
      try {
        const scope: PlatformScope = {
          tenantId: "local",
          projectId: pinProject.projectId,
          principalId: "owner_browser",
        };
        assert.equal(
          store.getRun(scope, queued.run.id).status,
          "needs_reconciliation",
        );
      } finally {
        store.close();
      }
      assert.equal(chatCount(provider.requests, "pin queued work"), 0);
    } finally {
      await withoutPin.close();
      await provider.close();
      rmSync(fixture.directory, { recursive: true, force: true });
      rmSync(pinFixture.directory, { recursive: true, force: true });
    }
  },
);

test(
  "real process crash requeues safe work and fences dispatched work",
  { timeout: 60_000 },
  async () => {
    const provider = await startSessionControlProvider();
    const fixture = hostEnv(provider.endpoint, {
      A008_PLATFORM_MAX_ACTIVE_RUNS: "1",
      A008_PLATFORM_LEASE_MS: "400",
      A008_PLATFORM_RENEW_MS: "50",
      A008_PLATFORM_SCAN_MS: "40",
      A008_PLATFORM_TURN_TIMEOUT_MS: "30000",
      A008_PLATFORM_SHUTDOWN_DRAIN_MS: "200",
    });
    const project = bootstrap(fixture.env, fixture.directory, "alpha");
    const credential = grant(fixture.env, [project.projectId]);
    const env = childEnv(fixture);
    const first = await startPlatformHostProcess({ env });
    const client = sdk(first.port, credential.credential);
    const holdPrompt = "crash WAIT-TURN";
    const safePrompt = "queued safe work";
    try {
      const heldConversation = await client.createConversation(
        project.projectId,
        {
          title: "Held",
        },
      );
      const safeConversation = await client.createConversation(
        project.projectId,
        {
          title: "Safe",
        },
      );
      const held = await client.createRun(heldConversation.conversation.id, {
        commandId: "crash-hold",
        expectedRevision: 0,
        model: MODEL,
        text: holdPrompt,
      });
      await waitFor("dispatch visible to the provider", async () => {
        const current = await client.getRun(held.run.id);
        if (
          current.run.status === "failed" ||
          current.run.status === "needs_reconciliation"
        ) {
          throw new Error(
            `${current.run.status} ${current.run.error?.message ?? ""} ${first.stderr()}`,
          );
        }
        return (
          chatCount(provider.requests, holdPrompt) === 1 &&
          current.run.effectStatus === "unknown"
        );
      });
      const safe = await client.createRun(safeConversation.conversation.id, {
        commandId: "crash-safe",
        expectedRevision: 0,
        model: MODEL,
        text: safePrompt,
      });
      assert.equal(safe.run.status, "queued");
      assert.equal(chatCount(provider.requests, safePrompt), 0);
      await first.kill();
    } finally {
      if (first.child.exitCode === null && first.child.signalCode === null)
        await first.kill();
    }
    assert.equal(chatCount(provider.requests, holdPrompt), 1);
    const second = await startPlatformHostProcess({ env });
    const restarted = sdk(second.port, credential.credential);
    try {
      await waitFor("restarted outcomes", async () => {
        const held = await restarted
          .getRun(
            (await restarted.listConversations(project.projectId)).conversations
              .find((conversation) => conversation.title === "Held")
              ?.messages.find((message) => message.role === "user")?.runId ??
              "",
          )
          .catch(() => undefined);
        const safeConversation = (
          await restarted.listConversations(project.projectId)
        ).conversations.find((conversation) => conversation.title === "Safe");
        const safeRunId = safeConversation?.messages.find(
          (message) => message.role === "user",
        )?.runId;
        if (
          held?.run.status !== "needs_reconciliation" ||
          safeRunId === undefined
        )
          return false;
        const safeRun = await restarted.getRun(safeRunId);
        return (
          safeRun.run.status === "succeeded" &&
          safeRun.run.answerStatus === "completed"
        );
      });
      assert.equal(chatCount(provider.requests, holdPrompt), 1);
      assert.equal(chatCount(provider.requests, safePrompt), 1);
      const safeConversation = (
        await restarted.listConversations(project.projectId)
      ).conversations.find((conversation) => conversation.title === "Safe");
      assert.equal(
        safeConversation?.messages.filter((message) => message.role === "user")
          .length,
        1,
      );
      assert.equal(
        safeConversation?.messages.some(
          (message) => message.role === "assistant",
        ),
        true,
      );
    } finally {
      await second.close();
      await provider.close();
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  },
);

test(
  "platform ownership is exclusive and a bind failure releases it",
  { timeout: 40_000 },
  async () => {
    const fixture = hostEnv(undefined, { A008_PLATFORM_SCAN_MS: "1000" });
    const env = childEnv(fixture);
    const owner = await startPlatformHostProcess({ env });
    const rival = spawnPlatformHost({ env });
    const rivalCode = await Promise.race([
      rival.exited,
      new Promise<number | null>((resolve) =>
        setTimeout(() => resolve(null), 10_000),
      ),
    ]);
    assert.equal(rivalCode, 1);
    assert.match(rival.stderr(), /exclusive process owner/u);
    const info = (await (
      await fetch(`http://127.0.0.1:${String(owner.port)}/v3/info`)
    ).json()) as {
      available: boolean;
    };
    assert.equal(info.available, true);

    const other = hostEnv(undefined);
    const otherEnv = childEnv(other);
    const blocked = spawnPlatformHost({ env: otherEnv, port: owner.port });
    const blockedCode = await Promise.race([
      blocked.exited,
      new Promise<number | null>((resolve) =>
        setTimeout(() => resolve(null), 10_000),
      ),
    ]);
    assert.equal(blockedCode, 1);
    assert.match(blocked.stderr(), /EADDRINUSE/u);
    const recovered = await startPlatformHostProcess({ env: otherEnv });
    try {
      const recoveredInfo = (await (
        await fetch(`http://127.0.0.1:${String(recovered.port)}/v3/info`)
      ).json()) as {
        available: boolean;
      };
      assert.equal(recoveredInfo.available, true);
      assert.equal(existsSync(other.env.A008_PLATFORM_PATH ?? ""), true);
    } finally {
      await recovered.close();
      await owner.close();
      rmSync(fixture.directory, { recursive: true, force: true });
      rmSync(other.directory, { recursive: true, force: true });
    }
  },
);
