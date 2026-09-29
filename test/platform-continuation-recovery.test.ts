import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { PlatformStore } from "../src/platform/platform-store.js";
import { inspectContinuationWorkspace } from "../src/platform/continuation-workspace.js";
import {
  RUN_CONTINUATION_STATE_VERSION,
  type RunContinuationCheckpointWrite,
} from "../src/core/chat-continuation.js";

const scope = {
  tenantId: "tenant",
  projectId: "project",
  principalId: "owner_gui",
};
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "a008-recovery-"));
  const cwd = join(directory, "workspace");
  mkdirSync(cwd);
  writeFileSync(join(cwd, "evidence.txt"), "original");
  for (const args of [
    ["init"],
    ["add", "."],
    [
      "-c",
      "user.name=A008",
      "-c",
      "user.email=a008@example.invalid",
      "commit",
      "-m",
      "seed",
    ],
  ])
    execFileSync("git", args, { cwd, stdio: "ignore", windowsHide: true });
  const filename = join(directory, "platform.sqlite");
  let now = 1000;
  const store = new PlatformStore({ filename, clock: () => now });
  const conversation = store.createConversation(scope, {
    title: "recovery",
    workspaceId: "workspace",
  });
  const run = store.acceptRun(scope, {
    conversationId: conversation.id,
    commandId: "command",
    expectedRevision: 0,
    model: "fixture",
    text: "continue",
  }).run;
  const claim = store.claimRun(scope, {
    runId: run.id,
    ownerToken: "owner",
    leaseDurationMs: 10000,
  });
  const lease = () => ({
    runId: run.id,
    ownerToken: "owner",
    generation: claim.lease.generation,
    expectedRevision: store.getRun(scope, run.id).revision,
  });
  store.recordDispatch(scope, lease());
  const interactions = [1, 2].map((n) => ({
    id: `runtime:${n}`,
    messages: [
      {
        role: "assistant" as const,
        content: "",
        toolCalls: [
          {
            id: `tool-${n}`,
            name: "read_file",
            arguments: '{"path":"evidence.txt"}',
          },
        ],
      },
      { role: "tool" as const, toolCallId: `tool-${n}`, content: "original" },
    ],
  }));
  store.recordActivity(scope, run.id, {
    thought: "",
    answer: "",
    tools: [1, 2].map((n) => ({
      type: "tool" as const,
      sessionId: conversation.id,
      id: `tool-${n}`,
      title: "read_file",
      status: "completed" as const,
      text: "original",
    })),
  });
  const state = {
    version: RUN_CONTINUATION_STATE_VERSION,
    runId: "runtime",
    verifiedFacts: [
      { id: "fact", statement: "original", sourceRefs: ["runtime:1"] },
    ],
    hypotheses: [],
    completedActions: [],
  };
  const checkpoint: RunContinuationCheckpointWrite = {
    runId: "runtime",
    state,
    sourceInteractions: [interactions[0]!],
    maximumStateBytes: 4096,
    recovery: {
      version: 1,
      state,
      recentInteractions: [interactions[1]!],
      completedInteractions: 2,
      usedToolCallIds: ["tool-1", "tool-2"],
      routeId: "fixture-route",
    },
  };
  const save = () =>
    store.saveContinuationBoundary(scope, lease(), checkpoint, cwd);
  const interrupt = () => store.markInterrupted(scope, lease());
  return {
    directory,
    cwd,
    filename,
    store,
    run,
    checkpoint,
    lease,
    save,
    interrupt,
    expire() {
      now += 20000;
      store.recoverExpiredLeases(scope);
    },
    dispose() {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test("recovery supplement survives reopen and consumes eligibility with a new lease", (t) => {
  const f = fixture();
  t.after(f.dispose);
  f.save();
  f.interrupt();
  const reopened = new PlatformStore({ filename: f.filename });
  try {
    const saved = reopened.readContinuationRecovery(scope, f.run.id)!;
    assert.equal(saved.sequence, 1);
    assert.deepEqual(saved.recovery, f.checkpoint.recovery);
    assert.equal(saved.evidence.verifiable, true);
    const claimed = reopened.claimContinuationRecovery(scope, {
      runId: f.run.id,
      ownerToken: "replacement",
      leaseDurationMs: 10000,
      expectedRevision: reopened.getRun(scope, f.run.id).revision,
      sequence: saved.sequence,
    });
    assert.equal(claimed.run.id, f.run.id);
    assert.equal(claimed.lease.generation, 2);
    assert.equal(reopened.readContinuationRecovery(scope, f.run.id), undefined);
    assert.throws(() => f.save(), /lease/i);
  } finally {
    reopened.close();
  }
});

test("latest valid checkpoint falls back only within the same effect fence", (t) => {
  const f = fixture();
  t.after(f.dispose);
  f.save();
  f.save();
  const db = new Database(f.filename);
  db.prepare(
    "UPDATE A008_run_continuation_checkpoints SET payload_json = '{}' WHERE sequence = 2",
  ).run();
  db.close();
  assert.equal(f.store.readContinuationRecovery(scope, f.run.id)?.sequence, 1);
  f.store.fenceContinuation(scope, f.lease());
  assert.equal(f.store.readContinuationRecovery(scope, f.run.id), undefined);
  assert.equal(
    f.store.latestContinuationCheckpoint(scope, {
      runId: f.run.id,
      turnId: f.run.id,
      workspaceId: "workspace",
    })?.sequence,
    1,
  );
});

for (const mode of [
  "cancel",
  "stop",
  "unknown-effect",
  "lease-expiry",
] as const) {
  test(`recovery respects ${mode} and never clears an unknown effect`, (t) => {
    const f = fixture();
    t.after(f.dispose);
    f.save();
    if (mode === "cancel")
      f.store.requestCancel(scope, {
        runId: f.run.id,
        expectedRevision: f.store.getRun(scope, f.run.id).revision,
      });
    else if (mode === "stop")
      f.store.disableContinuationRecovery(scope, f.run.id);
    else if (mode === "unknown-effect")
      f.store.fenceContinuation(scope, f.lease());
    if (mode === "lease-expiry") f.expire();
    else f.interrupt();
    assert.equal(
      f.store.getRun(scope, f.run.id).status,
      "needs_reconciliation",
    );
    assert.equal(f.store.getRun(scope, f.run.id).effectStatus, "unknown");
    assert.equal(
      Boolean(f.store.readContinuationRecovery(scope, f.run.id)),
      mode === "lease-expiry",
    );
    if (mode === "cancel") assert.throws(() => f.save(), /lease/i);
  });
}

test("workspace fingerprint detects tracked, untracked, ignored referenced artifacts, HEAD and missing paths", (t) => {
  const f = fixture();
  t.after(f.dispose);
  const artifacts = {
    paths: ["evidence.txt", "ignored.txt"],
    verifiable: true,
  };
  writeFileSync(join(f.cwd, ".gitignore"), "ignored.txt\n");
  writeFileSync(join(f.cwd, "ignored.txt"), "first");
  const first = inspectContinuationWorkspace(f.cwd, artifacts);
  assert.equal(first.verifiable, true);
  writeFileSync(join(f.cwd, "ignored.txt"), "second");
  assert.notEqual(
    inspectContinuationWorkspace(f.cwd, artifacts).digest,
    first.digest,
  );
  const second = inspectContinuationWorkspace(f.cwd, artifacts);
  writeFileSync(join(f.cwd, "untracked.txt"), "new");
  assert.notEqual(
    inspectContinuationWorkspace(f.cwd, artifacts).digest,
    second.digest,
  );
  const third = inspectContinuationWorkspace(f.cwd, artifacts);
  writeFileSync(join(f.cwd, "evidence.txt"), "changed");
  assert.notEqual(
    inspectContinuationWorkspace(f.cwd, artifacts).digest,
    third.digest,
  );
  const beforeBranch = inspectContinuationWorkspace(f.cwd, artifacts);
  execFileSync("git", ["checkout", "-b", "changed-branch"], {
    cwd: f.cwd,
    stdio: "ignore",
    windowsHide: true,
  });
  assert.notEqual(
    inspectContinuationWorkspace(f.cwd, artifacts).digest,
    beforeBranch.digest,
  );
  execFileSync(
    "git",
    [
      "-c",
      "user.name=A008",
      "-c",
      "user.email=a008@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "changed HEAD",
    ],
    { cwd: f.cwd, stdio: "ignore", windowsHide: true },
  );
  assert.notEqual(
    inspectContinuationWorkspace(f.cwd, artifacts).revision,
    beforeBranch.revision,
  );
  assert.equal(
    inspectContinuationWorkspace(join(f.cwd, "missing"), artifacts).verifiable,
    false,
  );
  assert.equal(
    inspectContinuationWorkspace(f.cwd, {
      paths: ["../outside"],
      verifiable: true,
    }).verifiable,
    false,
  );
});

test("failed boundary transaction preserves prior checkpoint and raw events", (t) => {
  const f = fixture();
  t.after(f.dispose);
  f.save();
  const before = f.store.readActivity(scope, f.run.id);
  const db = new Database(f.filename);
  db.exec(
    "CREATE TRIGGER reject_recovery BEFORE INSERT ON A008_continuation_recovery BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
  );
  assert.throws(f.save, /fixture failure/);
  db.close();
  assert.equal(f.store.readContinuationRecovery(scope, f.run.id)?.sequence, 1);
  assert.deepEqual(f.store.readActivity(scope, f.run.id), before);
});

test("v5 migration keeps old checkpoints readable but grants no recovery authority", (t) => {
  const f = fixture();
  t.after(f.dispose);
  f.save();
  const db = new Database(f.filename);
  db.exec(
    "DROP TABLE A008_continuation_recovery; DROP TABLE A008_continuation_fences; UPDATE A008_platform_schema SET version = 5",
  );
  db.close();
  const upgraded = new PlatformStore({ filename: f.filename });
  try {
    assert.equal(upgraded.schemaVersion, 6);
    assert.equal(upgraded.readContinuationRecovery(scope, f.run.id), undefined);
    assert.equal(
      upgraded.latestContinuationCheckpoint(scope, {
        runId: f.run.id,
        turnId: f.run.id,
        workspaceId: "workspace",
      })?.sequence,
      1,
    );
  } finally {
    upgraded.close();
  }
});

test("opaque tool evidence remains explicitly unverifiable and later work prevents resume", (t) => {
  const f = fixture();
  t.after(f.dispose);
  const interaction = f.checkpoint.sourceInteractions[0]!;
  const opaque = {
    ...interaction,
    messages: [
      {
        role: "assistant" as const,
        content: "",
        toolCalls: [
          {
            id: "tool-1",
            name: "exec_command",
            arguments: '{"command":"opaque"}',
          },
        ],
      },
      interaction.messages[1]!,
    ],
  };
  f.store.saveContinuationBoundary(
    scope,
    f.lease(),
    { ...f.checkpoint, sourceInteractions: [opaque] },
    f.cwd,
  );
  assert.equal(
    f.store.readContinuationRecovery(scope, f.run.id)?.evidence.verifiable,
    false,
  );
  f.interrupt();
  assert.throws(
    () =>
      f.store.claimContinuationRecovery(scope, {
        runId: f.run.id,
        ownerToken: "replacement",
        leaseDurationMs: 10000,
        expectedRevision: f.store.getRun(scope, f.run.id).revision,
        sequence: 1,
      }),
    /no longer owns/,
  );
  const reviewed = f.store.acknowledgeEffects(
    scope,
    f.run.id,
    f.store.getRun(scope, f.run.id).revision,
  );
  assert.equal(reviewed.status, "failed");
  assert.equal(reviewed.effectStatus, "known");
});
