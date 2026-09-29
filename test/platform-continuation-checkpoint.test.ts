import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { RuntimeIdentityFactory } from "../src/identity/runtime-id.js";
import { PlatformStore, PlatformStoreError } from "../src/platform/platform-store.js";
import type { PlatformScope } from "../src/platform/types.js";
import { RUN_CONTINUATION_STATE_VERSION } from "../src/core/chat-continuation.js";

const SCOPE: PlatformScope = { tenantId: "tenant", projectId: "project", principalId: "principal" };
const WORKSPACE = "workspace-a";

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "A008-continuation-checkpoint-"));
  const filename = join(directory, "platform.sqlite");
  let id = 0;
  const store = new PlatformStore({
    filename,
    identityFactory: new RuntimeIdentityFactory(() => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`),
  });
  const conversation = store.createConversation(SCOPE, { title: "checkpoint", workspaceId: WORKSPACE });
  const accepted = store.acceptRun(SCOPE, {
    conversationId: conversation.id, commandId: "command", expectedRevision: 0,
    model: "fixture", text: "question", runId: "platform-run",
  });
  return {
    filename, store, runId: accepted.run.id, conversationId: conversation.id,
    async dispose() { store.close(); await rm(directory, { recursive: true, force: true }); },
  };
}

function state(runtimeRunId: string, sourceRef: string) {
  return {
    version: RUN_CONTINUATION_STATE_VERSION, runId: runtimeRunId,
    verifiedFacts: [{ id: "fact", statement: "Observed result", sourceRefs: [sourceRef] }],
    hypotheses: [], completedActions: [],
  };
}

test("PlatformStore durably binds Task 1 source refs and round-trips latest checkpoint", async (t) => {
  const f = await fixture(); t.after(f.dispose);
  const runtimeRunId = "runtime-run-1";
  const sourceRef = `${runtimeRunId}:1`;
  const cursor = f.store.recordActivity(SCOPE, f.runId, {
    thought: "private", answer: "", tools: [{ type: "tool", sessionId: f.conversationId,
      id: "tool-1", title: "Inspect", status: "completed", text: "raw result" }],
  });
  f.store.bindContinuationSourceEvents(SCOPE, {
    runId: f.runId, turnId: f.runId, workspaceId: WORKSPACE, runtimeRunId,
    sourceRef, events: [{ toolCallId: "tool-1", eventCursor: cursor }],
  });
  const saved = f.store.saveContinuationCheckpoint(SCOPE, {
    runId: f.runId, turnId: f.runId, workspaceId: WORKSPACE, runtimeRunId,
    state: state(runtimeRunId, sourceRef), maximumStateBytes: 4096,
  });
  assert.equal(saved.sequence, 1);
  assert.deepEqual(saved.sourceRefs, [sourceRef]);
  f.store.close();
  const reopened = new PlatformStore({ filename: f.filename });
  try {
    assert.deepEqual(reopened.latestContinuationCheckpoint(SCOPE, {
      runId: f.runId, turnId: f.runId, workspaceId: WORKSPACE,
    }), saved);
    assert.equal(reopened.readActivity(SCOPE, f.runId)?.tools[0]?.text, "raw result");
  } finally {
    reopened.close();
  }
});
