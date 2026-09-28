import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { isolatedMemoryEnv, TEST_PROJECT_ID } from "./helpers.js";
import { startSessionControlProvider } from "./fixtures/session-control-provider.js";
import { createLocalMemoryRuntime } from "../src/runtime/local-memory-runtime.js";
import { SessionProcess } from "../src/platform/session-process.js";
import { DEFAULT_MODEL_ID } from "../src/core/model-registry.js";
import { RuntimeIdentityFactory } from "../src/identity/runtime-id.js";
import {
  PostOutputKnowledgeIntake,
  Utf8ByteKnowledgeIntakeMeasurer,
} from "../src/orchestration/post-output-knowledge-intake.js";
import { createSqliteKnowledgeContext } from "../src/memory/knowledge/sqlite-context.js";
import { KnowledgeEngineCommit } from "../src/memory/knowledge/live-commit.js";
import { scopeWorkspaceBatch } from "../src/memory/knowledge/workspace-observation.js";
import { KnowledgeMemoryReader } from "../src/memory/knowledge/live-reader.js";
import { contextItemsForModel } from "../src/memory/serialization.js";

test(
  "ADR 0055: real isolated child reuses PID and only host opens project memory",
  { timeout: 30000 },
  async () => {
    const provider = await startSessionControlProvider();
    const fixture = isolatedMemoryEnv({
      NVIDIA_CHAT_COMPLETIONS_URL: provider.endpoint,
      A008_CHAT_TRANSPORT: "direct",
    });
    const runtime = createLocalMemoryRuntime({
      env: fixture.env,
      surface: "test",
    });
    const cwd = join(fixture.directory, "workspace");
    mkdirSync(cwd);
    for (const args of [
      ["init"],
      [
        "-c",
        "user.name=A008",
        "-c",
        "user.email=a008@example.invalid",
        "commit",
        "--allow-empty",
        "-m",
        "fixture",
      ],
    ])
      execFileSync("git", args, { cwd, windowsHide: true, stdio: "ignore" });
    const child = new SessionProcess({
      sessionId: new RuntimeIdentityFactory().create("conversation"),
      workspaceId: "test-workspace",
      cwd,
      projectRoot: fixture.directory,
      projectId: TEST_PROJECT_ID,
      env: fixture.env,
      runtime,
      onIdentity() {},
    });
    try {
      const run = {
        runId: "first",
        model: DEFAULT_MODEL_ID,
        parameters: runtime.sessionParameters(DEFAULT_MODEL_ID),
        text: "Hello",
        history: [],
        tools: false,
      };
      const first = await child.complete(
        run,
        AbortSignal.timeout(15000),
        () => {},
      );
      assert.ok(first.answer, JSON.stringify(first));
      assert.equal(first.memoryStatus, "completed", JSON.stringify(first));
      const identity = child.identity();
      assert.notEqual(identity.processId, process.pid);
      const second = await child.complete(
        { ...run, runId: "second", text: "Again" },
        AbortSignal.timeout(15000),
        () => {},
      );
      assert.ok(second.answer, JSON.stringify(second));
      assert.deepEqual(child.identity(), identity);
      assert.equal(runtime.inspectMemory().summary.total, 0);
    } finally {
      await child.stop();
      runtime.close();
      await provider.close();
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  },
);



test("A008-0195: durable child resolves a stored image and sends provider-ready vision input", { timeout: 30000 }, async () => {
  const provider = await startSessionControlProvider();
  const fixture = isolatedMemoryEnv({
    NVIDIA_CHAT_COMPLETIONS_URL: provider.endpoint,
    A008_CHAT_TRANSPORT: "direct",
  });
  const hash = "a".repeat(64);
  const sourceRoot = join(fixture.directory, "sources");
  mkdirSync(join(sourceRoot, hash), { recursive: true });
  writeFileSync(
    join(sourceRoot, hash, "photo.png"),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
  );
  fixture.env.A008_SOURCE_STORE_PATH = sourceRoot;
  const runtime = createLocalMemoryRuntime({ env: fixture.env, surface: "test" });
  const cwd = join(fixture.directory, "vision-workspace");
  mkdirSync(cwd);
  for (const args of [
    ["init"],
    ["-c", "user.name=A008", "-c", "user.email=a008@example.invalid", "commit", "--allow-empty", "-m", "fixture"],
  ]) execFileSync("git", args, { cwd, windowsHide: true, stdio: "ignore" });
  const child = new SessionProcess({
    sessionId: new RuntimeIdentityFactory().create("conversation"),
    workspaceId: "vision-workspace",
    cwd,
    projectRoot: fixture.directory,
    projectId: TEST_PROJECT_ID,
    env: fixture.env,
    runtime,
    onIdentity() {},
  });
  const model = "moonshotai/kimi-k3";
  try {
    const outcome = await child.complete(
      {
        runId: "vision-run",
        model,
        parameters: runtime.sessionParameters(model),
        text: "Describe attached fixture image",
        attachment: {
          type: "image",
          locator: `source:${hash}/photo.png`,
          mediaType: "image/png",
        },
        history: [],
        tools: true,
      },
      AbortSignal.timeout(15000),
      () => {},
    );
    assert.ok(outcome.answer, JSON.stringify(outcome));
    const vision = provider.requests.find(
      (request) =>
        request.model === model &&
        JSON.stringify(request.messages).includes("Describe attached fixture image"),
    );
    assert.ok(vision, JSON.stringify(provider.requests));
    const serialized = JSON.stringify(vision);
    assert.match(serialized, /data:image\/png;base64,/u);
    assert.match(serialized, /image_url/u);
  } finally {
    await child.stop();
    runtime.close();
    await provider.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("ADR 0055: one SQLite owner retains independent workspace states and readable revision provenance", async () => {
  const fixture = isolatedMemoryEnv();
  const ids = new RuntimeIdentityFactory();
  const projectId = ids.create("project");
  let tick = 0;
  const handle = createSqliteKnowledgeContext({
    filename: fixture.sqlitePath,
    projectId,
    clock: () => `2026-09-27T12:00:${String(tick++).padStart(2, "0")}.000Z`,
  });
  const conversationId = ids.create("conversation"),
    agentId = ids.create("agent");
  try {
    for (const [workspaceId, value] of [
      ["left", "red"],
      ["right", "blue"],
      ["right", "green"],
    ]) {
      const sentence = `Widget color is ${value}`;
      const intake = new PostOutputKnowledgeIntake({
        analyzer: {
          analyze: async () => ({
            new_knowledge: [
              {
                proposition: sentence,
                kind: "property",
                severity: "important",
                tags: ["widget"],
                domains: ["fixture"],
                structuredProposition: {
                  kind: "attribute_binding",
                  entityLabel: "Widget",
                  attribute: "color",
                  value,
                },
                support: { source: "message", quote: sentence },
              },
            ],
            state_updates: [],
            relation_updates: [],
            reinforcements: [],
          }),
        },
        context: { projectId, conversationId, agentId },
        budget: {
          maximum: 64000,
          measurer: new Utf8ByteKnowledgeIntakeMeasurer(),
        },
      });
      const workspace = {
        workspaceId: workspaceId!,
        revision: `${workspaceId}-revision (working tree observation)`,
      };
      const batch = scopeWorkspaceBatch(
        await intake.stage({
          taskId: ids.create("task"),
          message: sentence,
          answer: "Recorded",
          applicabilityScopes: [],
        }),
        workspace,
        new Utf8ByteKnowledgeIntakeMeasurer(),
      );
      const commit = new KnowledgeEngineCommit({
        context: handle.context,
        workspace,
        classifier: {
          classify: async () => ({ type: "new" }),
          classifyBatch: async ({ candidates, items }) =>
            items.map((item) =>
              candidates.length
                ? {
                    proposalHandle: item.proposalHandle,
                    type: "supersede" as const,
                    targetHandle: candidates[0]!.handle,
                  }
                : { proposalHandle: item.proposalHandle, type: "new" as const },
            ),
        },
      });
      const results = await commit.commitBatch({
        batch,
        startProposalIndex: 0,
      });
      assert.equal(results.length, 1);
      assert.ok(!("error" in results[0]!), JSON.stringify(results));
    }
    const bindings = handle.context.state
      .snapshot()
      .bindings.filter((binding) => binding.interval.to === null);
    assert.equal(bindings.length, 2);
    assert.notEqual(
      JSON.stringify(bindings[0]!.slot),
      JSON.stringify(bindings[1]!.slot),
    );
    const read = await new KnowledgeMemoryReader({
      context: handle.context,
    }).read({
      projectId,
      conversationId,
      agentId,
      taskId: ids.create("task"),
      message: "widget",
      applicabilityScopes: [],
    });
    const model = contextItemsForModel(read.projection.projection.items);
    assert.ok(
      model.some(
        (item) => "currentState" in item && item.currentState === "green",
      ),
      JSON.stringify(model),
    );
    assert.ok(
      model.some(
        (item) => "currentState" in item && item.currentState === "red",
      ),
      JSON.stringify(model),
    );
    assert.ok(
      model.some((item) =>
        item.provenance?.some(
          (source) =>
            source.includes("workspace: left") &&
            source.includes("left-revision"),
        ),
      ),
      JSON.stringify(model),
    );
    assert.ok(
      model.some((item) =>
        item.provenance?.some((source) => source.includes("workspace: right")),
      ),
      JSON.stringify(model),
    );
    handle.close();
    const reopened = createSqliteKnowledgeContext({
      filename: fixture.sqlitePath,
      projectId,
    });
    try {
      assert.equal(
        reopened.context.state
          .snapshot()
          .bindings.filter((binding) => binding.interval.to === null).length,
        2,
      );
    } finally {
      reopened.close();
    }
  } finally {
    handle.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});
