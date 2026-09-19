import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { isV2SessionEventNewer } from "../packages/protocol/src/index.js";
import { executeProjectBootstrap } from "../src/bootstrap/service.js";
import { parseProjectBootstrapConfig } from "../src/bootstrap/validate.js";
import { ProjectRuntimeRegistry } from "../src/engine/project-runtime-registry.js";
import { V2SessionService } from "../src/gui-host/v2-session.js";
import type { V2Principal } from "../src/gui-host/v2-auth.js";
import { isolatedMemoryEnv } from "./helpers.js";
import { startSessionControlProvider } from "./fixtures/session-control-provider.js";

function fixture() {
  const f = isolatedMemoryEnv();
  f.env.A008_PROJECTS_PATH = join(f.directory, "projects.json");
  f.env.PATH = process.env.PATH;
  return f;
}

function createProject(f: ReturnType<typeof fixture>, name: string) {
  return executeProjectBootstrap(
    parseProjectBootstrapConfig({
      projectName: name,
      rootFolder: join(f.directory, name.replaceAll(" ", "-")),
      repository: { initialize: false },
      continuity: { docsFirst: false, multiAgent: { enabled: false } },
      memory: { useGlobalA008Memory: false },
    }),
    { registryPath: f.env.A008_PROJECTS_PATH! },
  ).project;
}

function principal(projects: readonly string[]): V2Principal {
  return {
    id: "principal_stage4",
    kind: "device",
    projects,
    capabilities: ["session"],
    expiresAt: Date.now() + 60_000,
  };
}

async function eventually(check: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for Stage 4 condition.");
}

test(
  "A008-0132 snapshot capture drains only events newer than represented sequence",
  { timeout: 15000 },
  async () => {
    const provider = await startSessionControlProvider();
    const f = fixture();
    f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
    const project = createProject(f, "Snapshot gap");
    const registry = new ProjectRuntimeRegistry({ env: f.env });
    const service = new V2SessionService({
      env: f.env,
      projectsPath: f.env.A008_PROJECTS_PATH!,
      registry,
      serverInstanceId: "server_stage4_snapshot",
    });
    const frames: any[] = [];
    const actor = principal([project.projectId]);
    const connectionId = "connection_snapshot";
    try {
      const opened = await service.newSession({
        principal: actor,
        projectId: project.projectId,
        connectionId,
        emit: (frame) => frames.push(frame),
      });
      const running = service.prompt(
        actor,
        project.projectId,
        opened.sessionId,
        connectionId,
        "WAIT-TURN",
      );
      await eventually(() =>
        frames.some(
          (frame) =>
            frame.type === "event" && frame.event === "thought/delta",
        ),
      );

      const snapshot = service.inspect(
        actor,
        project.projectId,
        opened.sessionId,
        connectionId,
      );
      service.cancel(actor, project.projectId, opened.sessionId, connectionId);
      await running;

      assert.equal(
        frames.some(
          (frame) =>
            frame.type === "event" && frame.event === "turn/terminal",
        ),
        false,
        "terminal event must stay queued until snapshot delivery finishes",
      );

      service.finishSnapshot(opened.sessionId, connectionId);
      const terminal = frames.find(
        (frame) =>
          frame.type === "event" && frame.event === "turn/terminal",
      );
      assert.ok(terminal);
      assert.equal(terminal.outcome, "cancelled");
      assert.ok(terminal.sequence > snapshot.sequence);
      assert.equal(terminal.serverInstanceId, "server_stage4_snapshot");
    } finally {
      await service.close();
      registry.close();
      await provider.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

test(
  "A008-0132 emits exactly one failed terminal outcome for a failed turn",
  { timeout: 15000 },
  async () => {
    const provider = await startSessionControlProvider();
    const f = fixture();
    f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
    const project = createProject(f, "Failed turn");
    const registry = new ProjectRuntimeRegistry({ env: f.env });
    const service = new V2SessionService({
      env: f.env,
      projectsPath: f.env.A008_PROJECTS_PATH!,
      registry,
      serverInstanceId: "server_stage4_failed",
    });
    const frames: any[] = [];
    const actor = principal([project.projectId]);
    const connectionId = "connection_failed";
    try {
      const opened = await service.newSession({
        principal: actor,
        projectId: project.projectId,
        connectionId,
        emit: (frame) => frames.push(frame),
      });
      await assert.rejects(() =>
        service.prompt(
          actor,
          project.projectId,
          opened.sessionId,
          connectionId,
          "FAIL-TURN",
        ),
      );
      const terminals = frames.filter(
        (frame) => frame.type === "event" && frame.event === "turn/terminal",
      );
      assert.equal(terminals.length, 1);
      assert.equal(terminals[0].outcome, "failed");
      assert.equal(terminals[0].answerStatus, "failed");
      assert.equal(terminals[0].memoryStatus, "unreported");
    } finally {
      await service.close();
      registry.close();
      await provider.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

test(
  "A008-0132 disconnect marks an active turn interrupted exactly once",
  { timeout: 15000 },
  async () => {
    const provider = await startSessionControlProvider();
    const f = fixture();
    f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
    const project = createProject(f, "Interrupted turn");
    const registry = new ProjectRuntimeRegistry({ env: f.env });
    const service = new V2SessionService({
      env: f.env,
      projectsPath: f.env.A008_PROJECTS_PATH!,
      registry,
      serverInstanceId: "server_stage4_interrupted",
    });
    const frames: any[] = [];
    const actor = principal([project.projectId]);
    const connectionId = "connection_interrupted";
    try {
      const opened = await service.newSession({
        principal: actor,
        projectId: project.projectId,
        connectionId,
        emit: (frame) => frames.push(frame),
      });
      const running = service.prompt(
        actor,
        project.projectId,
        opened.sessionId,
        connectionId,
        "WAIT-TURN",
      );
      await eventually(() =>
        frames.some(
          (frame) => frame.type === "event" && frame.event === "thought/delta",
        ),
      );
      await service.closeConnection(connectionId);
      await running.catch(() => undefined);
      const terminals = frames.filter(
        (frame) => frame.type === "event" && frame.event === "turn/terminal",
      );
      assert.equal(terminals.length, 1);
      assert.equal(terminals[0].outcome, "interrupted");
      assert.equal(terminals[0].answerStatus, "interrupted");
    } finally {
      await service.close();
      registry.close();
      await provider.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

test(
  "A008-0132 preserves surviving message IDs and retires undone/reset IDs",
  { timeout: 20000 },
  async () => {
    const provider = await startSessionControlProvider();
    const f = fixture();
    f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
    const project = createProject(f, "Message identity");
    const registry = new ProjectRuntimeRegistry({ env: f.env });
    const service = new V2SessionService({
      env: f.env,
      projectsPath: f.env.A008_PROJECTS_PATH!,
      registry,
      serverInstanceId: "server_stage4_messages",
    });
    const actor = principal([project.projectId]);
    const connectionId = "connection_messages";
    try {
      const opened = await service.newSession({
        principal: actor,
        projectId: project.projectId,
        connectionId,
        emit: () => undefined,
      });
      const first = await service.prompt(
        actor,
        project.projectId,
        opened.sessionId,
        connectionId,
        "first",
      );
      const firstIds = first.messages.map((message) => message.messageId);
      assert.equal(firstIds.length, 2);

      const second = await service.prompt(
        actor,
        project.projectId,
        opened.sessionId,
        connectionId,
        "second",
      );
      const secondIds = second.messages.map((message) => message.messageId);
      assert.deepEqual(secondIds.slice(0, 2), firstIds);
      assert.equal(new Set(secondIds).size, 4);

      const undone = await service.control(
        actor,
        project.projectId,
        opened.sessionId,
        connectionId,
        { action: "undo" },
      );
      assert.equal(undone.messages.length, 2);
      assert.deepEqual(
        undone.messages.map((message) => message.messageId),
        firstIds,
      );

      const secondAgain = await service.prompt(
        actor,
        project.projectId,
        opened.sessionId,
        connectionId,
        "second",
      );
      const secondAgainIds = secondAgain.messages.map(
        (message) => message.messageId,
      );
      assert.deepEqual(secondAgainIds.slice(0, 2), firstIds);
      assert.notDeepEqual(secondAgainIds.slice(2), secondIds.slice(2));

      const reset = await service.control(
        actor,
        project.projectId,
        opened.sessionId,
        connectionId,
        { action: "reset" },
      );
      assert.equal(reset.messages.length, 0);

      const firstAgain = await service.prompt(
        actor,
        project.projectId,
        opened.sessionId,
        connectionId,
        "first",
      );
      assert.notDeepEqual(
        firstAgain.messages.map((message) => message.messageId),
        firstIds,
      );
    } finally {
      await service.close();
      registry.close();
      await provider.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

test(
  "A008-0132 keeps sequence and turn identity independent across projects",
  { timeout: 20000 },
  async () => {
    const provider = await startSessionControlProvider();
    const f = fixture();
    f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
    const projectA = createProject(f, "Sequence A");
    const projectB = createProject(f, "Sequence B");
    const registry = new ProjectRuntimeRegistry({ env: f.env });
    const service = new V2SessionService({
      env: f.env,
      projectsPath: f.env.A008_PROJECTS_PATH!,
      registry,
      serverInstanceId: "server_stage4_multi",
    });
    const actor = principal([projectA.projectId, projectB.projectId]);
    const framesA: any[] = [];
    const framesB: any[] = [];
    try {
      const sessionA = await service.newSession({
        principal: actor,
        projectId: projectA.projectId,
        connectionId: "connection_a",
        emit: (frame) => framesA.push(frame),
      });
      const sessionB = await service.newSession({
        principal: actor,
        projectId: projectB.projectId,
        connectionId: "connection_b",
        emit: (frame) => framesB.push(frame),
      });

      await Promise.all([
        service.prompt(
          actor,
          projectA.projectId,
          sessionA.sessionId,
          "connection_a",
          "alpha",
        ),
        service.prompt(
          actor,
          projectB.projectId,
          sessionB.sessionId,
          "connection_b",
          "beta",
        ),
      ]);

      const eventsA = framesA.filter((frame) => frame.type === "event");
      const eventsB = framesB.filter((frame) => frame.type === "event");
      assert.equal(eventsA[0].sequence, 1);
      assert.equal(eventsB[0].sequence, 1);
      assert.deepEqual(
        eventsA.map((frame) => frame.sequence),
        eventsA.map((_: any, index: number) => index + 1),
      );
      assert.deepEqual(
        eventsB.map((frame) => frame.sequence),
        eventsB.map((_: any, index: number) => index + 1),
      );
      assert.notEqual(
        eventsA.find((frame) => frame.event === "turn/started").turnId,
        eventsB.find((frame) => frame.event === "turn/started").turnId,
      );
      const completed = eventsA.find(
        (frame) => frame.event === "turn/terminal",
      );
      assert.equal(completed.outcome, "completed");
      assert.equal(completed.answerStatus, "completed");
      assert.equal(completed.memoryStatus, "completed");
      assert.ok(
        [...eventsA, ...eventsB].every(
          (frame) => frame.serverInstanceId === "server_stage4_multi",
        ),
      );
    } finally {
      await service.close();
      registry.close();
      await provider.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

test("A008-0132 stale and duplicate event discard is deterministic", () => {
  const event = { sequence: 7 };
  assert.equal(isV2SessionEventNewer(6, event as any), true);
  assert.equal(isV2SessionEventNewer(7, event as any), false);
  assert.equal(isV2SessionEventNewer(8, event as any), false);
});
