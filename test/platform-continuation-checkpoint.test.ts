import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { RuntimeIdentityFactory } from "../src/identity/runtime-id.js";
import { PlatformStore } from "../src/platform/platform-store.js";
import type { PlatformScope } from "../src/platform/types.js";
import { RUN_CONTINUATION_STATE_VERSION } from "../src/core/chat-continuation.js";
import { createLocalMemoryRuntime } from "../src/runtime/local-memory-runtime.js";
import { isolatedMemoryEnv, memoryAwareFakeTransport } from "./helpers.js";

const SCOPE: PlatformScope = {
  tenantId: "tenant",
  projectId: "project",
  principalId: "principal",
};
const WORKSPACE = "workspace-a";

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "A008-continuation-checkpoint-"));
  const filename = join(directory, "platform.sqlite");
  let id = 0;
  const store = new PlatformStore({
    filename,
    identityFactory: new RuntimeIdentityFactory(
      () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
    ),
  });  const conversation = store.createConversation(SCOPE, {
    title: "checkpoint",
    workspaceId: WORKSPACE,
  });
  const accepted = store.acceptRun(SCOPE, {
    conversationId: conversation.id,
    commandId: "command",
    expectedRevision: 0,
    model: "fixture",
    text: "question",
    runId: "platform-run",
  });
  return {
    directory,
    filename,
    store,
    runId: accepted.run.id,
    conversationId: conversation.id,
    async dispose() {
      store.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

function state(runtimeRunId: string, sourceRef: string, statement = "Observed result") {
  return {
    version: RUN_CONTINUATION_STATE_VERSION,
    runId: runtimeRunId,
    verifiedFacts: [{ id: "fact", statement, sourceRefs: [sourceRef] }],
    hypotheses: [],
    completedActions: [],
  };
}function recordTool(
  store: PlatformStore,
  runId: string,
  conversationId: string,
  id: string,
  status: "completed" | "failed" = "completed",
): number {
  return store.recordActivity(SCOPE, runId, {
    thought: "private",
    answer: "",
    tools: [{
      type: "tool",
      sessionId: conversationId,
      id,
      title: "Inspect",
      status,
      text: status === "completed" ? "raw result" : "raw failure",
    }],
  });
}

function bind(
  store: PlatformStore,
  runId: string,
  _runtimeRunId: string,
  sourceRef: string,
  toolCallIds: readonly string[],
) {
  store.bindContinuationSourceInteraction(SCOPE, {
    runId,
    turnId: runId,
    workspaceId: WORKSPACE,
    interaction: {
      id: sourceRef,
      messages: [
        {
          role: "assistant",
          content: "",
          toolCalls: toolCallIds.map((id) => ({
            id,
            name: "inspect",
            arguments: "{}",
          })),
        },
        ...toolCallIds.map((toolCallId) => ({
          role: "tool" as const,
          toolCallId,
          content: "retained result",
        })),
      ],
    },
  });
}test("PlatformStore resolves live tool IDs and round-trips a durable checkpoint", async (t) => {
  const f = await fixture();
  t.after(f.dispose);
  const runtimeRunId = "runtime-run-1";
  const sourceRef = `${runtimeRunId}:1`;
  recordTool(f.store, f.runId, f.conversationId, "tool-1");
  bind(f.store, f.runId, runtimeRunId, sourceRef, ["tool-1"]);

  const saved = f.store.saveContinuationCheckpoint(SCOPE, {
    runId: f.runId,
    turnId: f.runId,
    workspaceId: WORKSPACE,
    runtimeRunId,
    state: state(runtimeRunId, sourceRef),
    maximumStateBytes: 4096,
  });
  assert.equal(saved.sequence, 1);
  assert.deepEqual(saved.sourceRefs, [sourceRef]);

  f.store.close();
  const reopened = new PlatformStore({ filename: f.filename });
  try {
    assert.deepEqual(
      reopened.latestContinuationCheckpoint(SCOPE, {
        runId: f.runId,
        turnId: f.runId,
        workspaceId: WORKSPACE,
      }),
      saved,
    );
    assert.equal(reopened.readActivity(SCOPE, f.runId)?.tools[0]?.text, "raw result");
  } finally {
    reopened.close();
  }
});

test("binding rejects fabricated evidence but accepts retained failed tool evidence", async (t) => {
  const f = await fixture();
  t.after(f.dispose);
  const runtimeRunId = "runtime-run-terminal";
  assert.throws(
    () => bind(f.store, f.runId, runtimeRunId, `${runtimeRunId}:1`, ["missing-tool"]),
    /not retained terminal raw evidence/u,
  );

  recordTool(f.store, f.runId, f.conversationId, "failed-tool", "failed");
  bind(f.store, f.runId, runtimeRunId, `${runtimeRunId}:1`, ["failed-tool"]);
  bind(f.store, f.runId, runtimeRunId, `${runtimeRunId}:1`, ["failed-tool"]);
  recordTool(f.store, f.runId, f.conversationId, "different-tool");
  assert.throws(
    () => bind(f.store, f.runId, runtimeRunId, `${runtimeRunId}:1`, ["different-tool"]),
    /already bound to different raw evidence/u,
  );
  const saved = f.store.saveContinuationCheckpoint(SCOPE, {
    runId: f.runId,
    turnId: f.runId,
    workspaceId: WORKSPACE,
    runtimeRunId,
    state: state(runtimeRunId, `${runtimeRunId}:1`, "The tool failed."),
    maximumStateBytes: 4096,
  });
  assert.equal(saved.sequence, 1);

  assert.throws(
    () => f.store.bindContinuationSourceInteraction(SCOPE, {
      runId: f.runId,
      turnId: f.runId,
      workspaceId: "wrong-workspace",
      interaction: {
        id: `${runtimeRunId}:2`,
        messages: [
          {
            role: "assistant",
            content: "",
            toolCalls: [{ id: "failed-tool", name: "inspect", arguments: "{}" }],
          },
          { role: "tool", toolCallId: "failed-tool", content: "raw failure" },
        ],
      },
    }),
    /binding does not match/u,
  );
});

test("schema v4 migrates additively to v5 without losing the existing run", async (t) => {
  const f = await fixture();
  t.after(async () => {
    await rm(f.directory, { recursive: true, force: true });
  });
  f.store.close();
  const old = new Database(f.filename);
  old.exec(`
    DROP TABLE A008_run_continuation_checkpoints;
    DROP TABLE A008_run_continuation_source_events;
    DROP TABLE A008_run_continuation_sources;
    UPDATE A008_platform_schema SET version = 4 WHERE singleton = 1;
  `);
  old.close();

  const migrated = new PlatformStore({ filename: f.filename });
  try {
    assert.equal(migrated.getRun(SCOPE, f.runId).id, f.runId);
    recordTool(migrated, f.runId, f.conversationId, "tool-migrated");
    bind(migrated, f.runId, "runtime-migrated", "runtime-migrated:1", ["tool-migrated"]);
    assert.equal(
      migrated.saveContinuationCheckpoint(SCOPE, {
        runId: f.runId,
        turnId: f.runId,
        workspaceId: WORKSPACE,
        runtimeRunId: "runtime-migrated",
        state: state("runtime-migrated", "runtime-migrated:1"),
        maximumStateBytes: 4096,
      }).sequence,
      1,
    );
  } finally {
    migrated.close();
  }
  const inspect = new Database(f.filename, { readonly: true });
  assert.equal((inspect.prepare("SELECT version FROM A008_platform_schema WHERE singleton = 1")
    .get() as { version: number }).version, 5);
  inspect.close();
});

test("latest-valid read skips a corrupt newer checkpoint without repairing or deleting it", async (t) => {
  const f = await fixture();
  t.after(f.dispose);
  const runtimeRunId = "runtime-fallback";
  recordTool(f.store, f.runId, f.conversationId, "tool-fallback");
  bind(f.store, f.runId, runtimeRunId, `${runtimeRunId}:1`, ["tool-fallback"]);
  bind(f.store, f.runId, runtimeRunId, `${runtimeRunId}:2`, ["tool-fallback"]);
  const first = f.store.saveContinuationCheckpoint(SCOPE, {
    runId: f.runId, turnId: f.runId, workspaceId: WORKSPACE, runtimeRunId,
    state: state(runtimeRunId, `${runtimeRunId}:1`, "first"), maximumStateBytes: 4096,
  });
  const second = f.store.saveContinuationCheckpoint(SCOPE, {
    runId: f.runId, turnId: f.runId, workspaceId: WORKSPACE, runtimeRunId,
    state: state(runtimeRunId, `${runtimeRunId}:2`, "second"), maximumStateBytes: 4096,
  });
  assert.equal(second.sequence, 2);

  const corrupt = new Database(f.filename);
  corrupt.prepare(
    "UPDATE A008_run_continuation_checkpoints SET payload_json = ? WHERE run_id = ? AND sequence = 2",
  ).run(JSON.stringify({ version: "corrupt" }), f.runId);
  corrupt.close();

  assert.deepEqual(
    f.store.latestContinuationCheckpoint(SCOPE, {
      runId: f.runId, turnId: f.runId, workspaceId: WORKSPACE,
    }),
    first,
  );
  const inspect = new Database(f.filename, { readonly: true });
  assert.equal((inspect.prepare(
    "SELECT count(*) AS count FROM A008_run_continuation_checkpoints WHERE run_id = ?",
  ).get(f.runId) as { count: number }).count, 2);
  inspect.close();
});

test("failed checkpoint transaction preserves the previously committed valid checkpoint", async (t) => {
  const f = await fixture();
  t.after(f.dispose);
  const runtimeRunId = "runtime-atomic";
  recordTool(f.store, f.runId, f.conversationId, "tool-atomic");
  bind(f.store, f.runId, runtimeRunId, `${runtimeRunId}:1`, ["tool-atomic"]);
  bind(f.store, f.runId, runtimeRunId, `${runtimeRunId}:2`, ["tool-atomic"]);
  const first = f.store.saveContinuationCheckpoint(SCOPE, {
    runId: f.runId, turnId: f.runId, workspaceId: WORKSPACE, runtimeRunId,
    state: state(runtimeRunId, `${runtimeRunId}:1`), maximumStateBytes: 4096,
  });

  const injection = new Database(f.filename);
  injection.exec(`
    CREATE TRIGGER A008_abort_checkpoint
    BEFORE INSERT ON A008_run_continuation_checkpoints
    WHEN NEW.sequence = 2
    BEGIN SELECT RAISE(ABORT, 'injected checkpoint failure'); END;
  `);
  assert.throws(
    () => f.store.saveContinuationCheckpoint(SCOPE, {
      runId: f.runId, turnId: f.runId, workspaceId: WORKSPACE, runtimeRunId,
      state: state(runtimeRunId, `${runtimeRunId}:2`), maximumStateBytes: 4096,
    }),
    /injected checkpoint failure/u,
  );
  injection.close();
  assert.deepEqual(
    f.store.latestContinuationCheckpoint(SCOPE, {
      runId: f.runId, turnId: f.runId, workspaceId: WORKSPACE,
    }),
    first,
  );
});

test("checkpoint payload never appears in ordinary semantic-memory recall", async (t) => {
  const f = await fixture();
  t.after(f.dispose);
  const marker = "checkpoint-only-cobalt-0197";
  const runtimeRunId = "runtime-isolation";
  recordTool(f.store, f.runId, f.conversationId, "tool-isolation");
  bind(f.store, f.runId, runtimeRunId, `${runtimeRunId}:1`, ["tool-isolation"]);
  f.store.saveContinuationCheckpoint(SCOPE, {
    runId: f.runId, turnId: f.runId, workspaceId: WORKSPACE, runtimeRunId,
    state: state(runtimeRunId, `${runtimeRunId}:1`, marker), maximumStateBytes: 4096,
  });

  const isolated = isolatedMemoryEnv();
  const transport = memoryAwareFakeTransport({
    chat: () => ({ content: "unused" }),
  });
  const runtime = createLocalMemoryRuntime({
    env: isolated.env,
    surface: "test",
    createTransport: () => transport,
  });
  try {
    const recalled = await runtime.recallSharedMemory({ query: marker });
    assert.equal(
      recalled.items.some((item) => item.content.includes(marker)),
      false,
    );
    assert.equal(transport.requests.length, 0);
  } finally {
    runtime.close();
    await rm(isolated.directory, { recursive: true, force: true });
  }
});