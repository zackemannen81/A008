import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { executeProjectBootstrap } from "../src/bootstrap/service.js";
import { parseProjectBootstrapConfig } from "../src/bootstrap/validate.js";
import { ProjectRuntimeRegistry } from "../src/engine/project-runtime-registry.js";
import { V2AuthError, type V2Principal } from "../src/gui-host/v2-auth.js";
import { V2SessionService } from "../src/gui-host/v2-session.js";
import { startSessionControlProvider } from "./fixtures/session-control-provider.js";
import { isolatedMemoryEnv } from "./helpers.js";

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

function principal(
  id: string,
  projects: readonly string[],
  capabilities: V2Principal["capabilities"] = ["session"],
): V2Principal {
  return {
    id,
    kind: "device",
    projects,
    capabilities,
    expiresAt: Number.MAX_SAFE_INTEGER,
  };
}

const hasCode = (expected: string) => (error: unknown) =>
  error instanceof V2AuthError && error.code === expected;

test(
  "A008-0139 detach preserves only bounded same-process resume authority",
  { timeout: 15000 },
  async () => {
    const provider = await startSessionControlProvider();
    const f = fixture();
    f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
    const project = createProject(f, "Resume lease");
    const registry = new ProjectRuntimeRegistry({ env: f.env });
    let now = 1_000;
    const service = new V2SessionService({
      env: f.env,
      projectsPath: f.env.A008_PROJECTS_PATH!,
      registry,
      serverInstanceId: "server_resume_lease",
      now: () => now,
      resumeLeaseMs: 45_000,
    });
    const owner = principal("principal_owner", [project.projectId]);
    const foreign = principal("principal_foreign", [project.projectId]);
    const framesA: any[] = [];
    const framesB: any[] = [];
    try {
      const opened = await service.newSession({
        principal: owner,
        projectId: project.projectId,
        connectionId: "connection_a",
        emit: (frame) => framesA.push(frame),
      });
      const capability = service.resumeCapability(
        owner,
        project.projectId,
        opened.sessionId,
        "connection_a",
      );
      assert.match(capability, /^[A-Za-z0-9_-]{32,128}$/u);
      assert.equal(JSON.stringify(opened).includes(capability), false);

      await service.closeConnection("connection_a");
      assert.equal(
        service.sessionAuthorized(owner, project.projectId, opened.sessionId),
        true,
      );

      await assert.rejects(
        () =>
          service.resumeSession({
            principal: foreign,
            projectId: project.projectId,
            sessionId: opened.sessionId,
            connectionId: "connection_foreign",
            resumeCapability: capability,
            emit: () => undefined,
          }),
        hasCode("SESSION_EXPIRED"),
      );
      await assert.rejects(
        () =>
          service.resumeSession({
            principal: owner,
            projectId: project.projectId,
            sessionId: opened.sessionId,
            connectionId: "connection_wrong_capability",
            resumeCapability: "x".repeat(43),
            emit: () => undefined,
          }),
        hasCode("SESSION_EXPIRED"),
      );

      now += 44_999;
      const resumed = await service.resumeSession({
        principal: owner,
        projectId: project.projectId,
        sessionId: opened.sessionId,
        connectionId: "connection_b",
        resumeCapability: capability,
        emit: (frame) => framesB.push(frame),
      });
      assert.equal(resumed.sessionId, opened.sessionId);
      assert.equal(resumed.active, false);
      assert.equal(JSON.stringify(resumed).includes(capability), false);
      service.finishSnapshot(opened.sessionId, "connection_b");

      await assert.rejects(
        () =>
          service.resumeSession({
            principal: owner,
            projectId: project.projectId,
            sessionId: opened.sessionId,
            connectionId: "connection_second_writer",
            resumeCapability: capability,
            emit: () => undefined,
          }),
        hasCode("SESSION_BUSY"),
      );

      await service.closeConnection("connection_b");
      now += 45_000;
      await assert.rejects(
        () =>
          service.resumeSession({
            principal: owner,
            projectId: project.projectId,
            sessionId: opened.sessionId,
            connectionId: "connection_expired",
            resumeCapability: capability,
            emit: () => undefined,
          }),
        hasCode("SESSION_EXPIRED"),
      );
      assert.equal(
        service.sessionAuthorized(owner, project.projectId, opened.sessionId),
        false,
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
  "A008-0139 detach interrupts active work before lease and resume never replays transient output",
  { timeout: 15000 },
  async () => {
    const provider = await startSessionControlProvider();
    const f = fixture();
    f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
    const project = createProject(f, "Resume interruption");
    const registry = new ProjectRuntimeRegistry({ env: f.env });
    const service = new V2SessionService({
      env: f.env,
      projectsPath: f.env.A008_PROJECTS_PATH!,
      registry,
      serverInstanceId: "server_resume_interrupt",
      resumeLeaseMs: 45_000,
    });
    const owner = principal("principal_owner", [project.projectId]);
    const framesA: any[] = [];
    const framesB: any[] = [];
    try {
      const opened = await service.newSession({
        principal: owner,
        projectId: project.projectId,
        connectionId: "connection_a",
        emit: (frame) => framesA.push(frame),
      });
      const capability = service.resumeCapability(
        owner,
        project.projectId,
        opened.sessionId,
        "connection_a",
      );
      const running = service.prompt(
        owner,
        project.projectId,
        opened.sessionId,
        "connection_a",
        "WAIT-TURN",
      );
      const deadline = Date.now() + 4_000;
      while (
        !framesA.some(
          (frame) => frame.type === "event" && frame.event === "thought/delta",
        ) &&
        Date.now() < deadline
      )
        await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(
        framesA.some(
          (frame) => frame.type === "event" && frame.event === "thought/delta",
        ),
        true,
      );

      const providerCallsBeforeDetach = provider.requests.filter(
        (payload) =>
          !String(payload.messages?.at(-1)?.content ?? "").includes(
            '"operation"',
          ),
      ).length;
      await service.closeConnection("connection_a");
      await running.catch(() => undefined);

      const resumed = await service.resumeSession({
        principal: owner,
        projectId: project.projectId,
        sessionId: opened.sessionId,
        connectionId: "connection_b",
        resumeCapability: capability,
        emit: (frame) => framesB.push(frame),
      });
      assert.equal(resumed.active, false);
      assert.equal(resumed.activeTurn, undefined);
      assert.equal(
        resumed.sequence,
        framesA.find(
          (frame) =>
            frame.type === "event" &&
            frame.event === "turn/terminal" &&
            frame.outcome === "interrupted",
        )?.sequence,
      );
      service.finishSnapshot(opened.sessionId, "connection_b");
      assert.equal(
        framesB.some(
          (frame) =>
            frame.type === "event" &&
            (frame.event === "thought/delta" ||
              frame.event === "answer/delta" ||
              frame.event === "tool/permission"),
        ),
        false,
      );
      const providerCallsAfterResume = provider.requests.filter(
        (payload) =>
          !String(payload.messages?.at(-1)?.content ?? "").includes(
            '"operation"',
          ),
      ).length;
      assert.equal(providerCallsAfterResume, providerCallsBeforeDetach);
    } finally {
      await service.close();
      registry.close();
      await provider.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
