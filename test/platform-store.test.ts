import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { RuntimeIdentityFactory } from "../src/identity/runtime-id.js";
import {
  PlatformStore,
  PlatformStoreError,
} from "../src/platform/platform-store.js";
import type { PlatformScope } from "../src/platform/types.js";

const SCOPE: PlatformScope = {
  tenantId: "tenant-a",
  projectId: "project-a",
  principalId: "principal-a",
};

const OTHER_TENANT: PlatformScope = {
  tenantId: "tenant-b",
  projectId: "project-a",
  principalId: "principal-b",
};

const OTHER_PROJECT: PlatformScope = {
  tenantId: "tenant-a",
  projectId: "project-b",
  principalId: "principal-a",
};

function expectCode(code: string): (error: unknown) => boolean {
  return (error: unknown): boolean =>
    error instanceof PlatformStoreError && error.code === code;
}

async function fixture(): Promise<{
  readonly filename: string;
  readonly dispose: () => Promise<void>;
  readonly store: PlatformStore;
  advance(milliseconds: number): void;
}> {
  const directory = await mkdtemp(join(tmpdir(), "A008-platform-store-"));
  const filename = join(directory, "platform.sqlite");
  let now = 1_700_000_000_000;
  let identity = 0;
  let opaque = 0;
  const store = new PlatformStore({
    filename,
    clock: () => now,
    identityFactory: new RuntimeIdentityFactory(() => {
      identity += 1;
      return `00000000-0000-4000-8000-${String(identity).padStart(12, "0")}`;
    }),
    idFactory: () => {
      opaque += 1;
      return String(opaque);
    },
  });
  return {
    filename,
    store,
    advance(milliseconds: number) {
      now += milliseconds;
    },
    async dispose() {
      store.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test("accept is atomic, replay precedes revision/busy checks, and scopes isolate", async (t) => {
  const f = await fixture();
  t.after(f.dispose);
  const conversation = f.store.createConversation(SCOPE, {
    title: "A platform task",
  });

  assert.throws(
    () =>
      f.store.acceptRun(SCOPE, {
        conversationId: conversation.id,
        commandId: "bad-revision",
        expectedRevision: 4,
        model: "model-a",
        text: "must not persist",
      }),
    expectCode("REVISION_CONFLICT"),
  );
  assert.equal(
    f.store.getConversation(SCOPE, conversation.id).messages.length,
    0,
  );

  const first = f.store.acceptRun(SCOPE, {
    conversationId: conversation.id,
    commandId: "command-1",
    expectedRevision: 0,
    model: "model-a",
    text: "hello",
  });
  assert.equal(first.replayed, false);
  assert.equal(first.run.status, "queued");
  assert.equal(f.store.getConversation(SCOPE, conversation.id).revision, 1);
  assert.equal(
    f.store.getConversation(SCOPE, conversation.id).messages.length,
    1,
  );

  const replay = f.store.acceptRun(SCOPE, {
    conversationId: conversation.id,
    commandId: "command-1",
    expectedRevision: 0,
    model: "model-a",
    text: "hello",
  });
  assert.deepEqual(replay, { run: first.run, replayed: true });
  assert.throws(
    () =>
      f.store.acceptRun(SCOPE, {
        conversationId: conversation.id,
        commandId: "command-1",
        expectedRevision: 1,
        model: "model-a",
        text: "changed",
      }),
    expectCode("COMMAND_CONFLICT"),
  );
  assert.throws(
    () =>
      f.store.acceptRun(SCOPE, {
        conversationId: conversation.id,
        commandId: "command-2",
        expectedRevision: 1,
        model: "model-a",
        text: "second writer",
      }),
    expectCode("CONVERSATION_BUSY"),
  );
  assert.throws(
    () => f.store.getConversation(OTHER_TENANT, conversation.id),
    expectCode("NOT_FOUND"),
  );
  assert.throws(
    () => f.store.getConversation(OTHER_PROJECT, conversation.id),
    expectCode("NOT_FOUND"),
  );
  assert.deepEqual(f.store.listConversations(OTHER_TENANT), []);
  assert.deepEqual(f.store.listConversations(OTHER_PROJECT), []);
  assert.equal(f.store.readEvents(OTHER_TENANT).events.length, 0);
  assert.equal(f.store.readEvents(SCOPE).events.length, 3);
  assert.deepEqual(f.store.listRuns(SCOPE, { statuses: ["queued"] }), [
    first.run,
  ]);
});

test("leases fence stale writers and recovery distinguishes pre-dispatch from unknown effects", async (t) => {
  const f = await fixture();
  t.after(f.dispose);
  const firstConversation = f.store.createConversation(SCOPE, {
    title: "first",
  });
  const first = f.store.acceptRun(SCOPE, {
    conversationId: firstConversation.id,
    commandId: "dispatch",
    expectedRevision: 0,
    model: "model-a",
    text: "first",
  });
  const firstLease = f.store.claimRun(SCOPE, {
    runId: first.run.id,
    ownerToken: "worker-a",
    leaseDurationMs: 10,
  });
  assert.throws(
    () =>
      f.store.renewLease(SCOPE, {
        runId: first.run.id,
        ownerToken: "worker-a",
        generation: firstLease.lease.generation - 1,
        leaseDurationMs: 10,
      }),
    expectCode("LEASE_LOST"),
  );
  assert.throws(
    () =>
      f.store.recordDispatch(SCOPE, {
        runId: first.run.id,
        ownerToken: "worker-a",
        generation: firstLease.lease.generation - 1,
        expectedRevision: firstLease.run.revision,
      }),
    expectCode("LEASE_LOST"),
  );
  const dispatched = f.store.recordDispatch(SCOPE, {
    runId: first.run.id,
    ownerToken: "worker-a",
    generation: firstLease.lease.generation,
    expectedRevision: firstLease.run.revision,
  });
  assert.equal(dispatched.effectStatus, "unknown");
  f.advance(10);
  assert.equal(
    f.store.recoverExpiredLeases(SCOPE)[0]?.status,
    "needs_reconciliation",
  );
  assert.throws(
    () =>
      f.store.claimRun(SCOPE, {
        runId: first.run.id,
        ownerToken: "worker-b",
        leaseDurationMs: 10,
      }),
    expectCode("LEASE_LOST"),
  );
  assert.throws(
    () =>
      f.store.requestCancel(SCOPE, {
        runId: first.run.id,
        expectedRevision: f.store.getRun(SCOPE, first.run.id).revision,
      }),
    expectCode("NEEDS_RECONCILIATION"),
  );
  assert.throws(
    () =>
      f.store.commitAnswer(SCOPE, {
        runId: first.run.id,
        ownerToken: "worker-a",
        generation: firstLease.lease.generation,
        expectedRevision: dispatched.revision,
        content: "late answer",
      }),
    expectCode("LEASE_LOST"),
  );

  const secondConversation = f.store.createConversation(SCOPE, {
    title: "second",
  });
  const second = f.store.acceptRun(SCOPE, {
    conversationId: secondConversation.id,
    commandId: "pre-dispatch",
    expectedRevision: 0,
    model: "model-a",
    text: "second",
  });
  const secondLease = f.store.claimRun(SCOPE, {
    runId: second.run.id,
    ownerToken: "worker-a",
    leaseDurationMs: 10,
  });
  f.advance(10);
  const recovered = f.store.recoverExpiredLeases(SCOPE);
  assert.equal(
    recovered.find((run) => run.id === second.run.id)?.status,
    "queued",
  );
  const replacement = f.store.claimRun(SCOPE, {
    runId: second.run.id,
    ownerToken: "worker-b",
    leaseDurationMs: 10,
  });
  assert.equal(replacement.lease.generation, secondLease.lease.generation + 1);

  const cancelledConversation = f.store.createConversation(SCOPE, {
    title: "cancel recovery",
  });
  const cancelled = f.store.acceptRun(SCOPE, {
    conversationId: cancelledConversation.id,
    commandId: "cancel-before-dispatch",
    expectedRevision: 0,
    model: "model-a",
    text: "cancel me",
  });
  const cancelledLease = f.store.claimRun(SCOPE, {
    runId: cancelled.run.id,
    ownerToken: "worker-c",
    leaseDurationMs: 10,
  });
  f.store.requestCancel(SCOPE, {
    runId: cancelled.run.id,
    expectedRevision: cancelledLease.run.revision,
  });
  f.advance(10);
  assert.equal(
    f.store
      .recoverExpiredLeases(SCOPE)
      .find((run) => run.id === cancelled.run.id)?.status,
    "cancelled",
  );
});

test("answer, message, event and memory outcome commit with one terminal winner", async (t) => {
  const f = await fixture();
  t.after(f.dispose);
  const conversation = f.store.createConversation(SCOPE, { title: "answer" });
  const accepted = f.store.acceptRun(SCOPE, {
    conversationId: conversation.id,
    commandId: "answer-command",
    expectedRevision: 0,
    model: "model-a",
    text: "question",
    memoryRequested: true,
  });
  const claimed = f.store.claimRun(SCOPE, {
    runId: accepted.run.id,
    ownerToken: "worker-a",
    leaseDurationMs: 100,
  });
  const cancellation = f.store.requestCancel(SCOPE, {
    runId: accepted.run.id,
    expectedRevision: claimed.run.revision,
  });
  assert.equal(cancellation.status, "cancel_requested");
  const completed = f.store.commitAnswer(SCOPE, {
    runId: accepted.run.id,
    ownerToken: "worker-a",
    generation: claimed.lease.generation,
    expectedRevision: cancellation.revision,
    content: "answer",
  });
  assert.equal(completed.status, "succeeded");
  assert.equal(completed.answerStatus, "completed");
  assert.equal(completed.memoryStatus, "pending");
  assert.equal(
    f.store.getConversation(SCOPE, conversation.id).messages.length,
    2,
  );
  const memory = f.store.recordMemoryOutcome(SCOPE, {
    runId: accepted.run.id,
    expectedRevision: completed.revision,
    status: "failed",
  });
  assert.equal(memory.status, "succeeded");
  assert.equal(memory.memoryStatus, "failed");
  assert.equal(
    f.store.requestCancel(SCOPE, {
      runId: accepted.run.id,
      expectedRevision: 0,
    }).status,
    "succeeded",
  );

  const page = f.store.readEvents(SCOPE, { limit: 2 });
  assert.equal(page.events.length, 2);
  assert.equal(page.hasMore, true);
  const next = f.store.readEvents(SCOPE, {
    after: page.nextCursor,
    limit: 100,
  });
  assert.ok(next.events.every((event) => event.cursor > page.nextCursor));

  const dispatchedConversation = f.store.createConversation(SCOPE, {
    title: "unknown cancellation",
  });
  const dispatched = f.store.acceptRun(SCOPE, {
    conversationId: dispatchedConversation.id,
    commandId: "unknown-cancel",
    expectedRevision: 0,
    model: "model-a",
    text: "unknown",
  });
  const dispatchedLease = f.store.claimRun(SCOPE, {
    runId: dispatched.run.id,
    ownerToken: "worker-b",
    leaseDurationMs: 100,
  });
  const dispatch = f.store.recordDispatch(SCOPE, {
    runId: dispatched.run.id,
    ownerToken: "worker-b",
    generation: dispatchedLease.lease.generation,
    expectedRevision: dispatchedLease.run.revision,
  });
  const requested = f.store.requestCancel(SCOPE, {
    runId: dispatched.run.id,
    expectedRevision: dispatch.revision,
  });
  assert.throws(
    () =>
      f.store.confirmCancellation(SCOPE, {
        runId: dispatched.run.id,
        ownerToken: "worker-b",
        generation: dispatchedLease.lease.generation,
        expectedRevision: requested.revision,
      }),
    expectCode("NEEDS_RECONCILIATION"),
  );
});

test("a receipt trigger aborts a partially started acceptance without durable fragments", async (t) => {
  const f = await fixture();
  t.after(f.dispose);
  const conversation = f.store.createConversation(SCOPE, { title: "rollback" });
  const injection = new Database(f.filename);
  injection.exec(`
    CREATE TRIGGER A008_platform_abort_receipt
    BEFORE INSERT ON A008_platform_command_receipts
    BEGIN SELECT RAISE(ABORT, 'injected receipt failure'); END;
  `);
  assert.throws(
    () =>
      f.store.acceptRun(SCOPE, {
        conversationId: conversation.id,
        commandId: "injected-failure",
        expectedRevision: 0,
        model: "model-a",
        text: "must roll back",
      }),
    /injected receipt failure/u,
  );
  injection.close();
  assert.equal(f.store.getConversation(SCOPE, conversation.id).revision, 0);
  assert.equal(
    f.store.getConversation(SCOPE, conversation.id).messages.length,
    0,
  );
  assert.deepEqual(f.store.listRuns(SCOPE), []);
  assert.equal(f.store.readEvents(SCOPE).events.length, 1);
});

test("state survives independent reopen, future schemas fail, and closed stores reject writes", async (t) => {
  const f = await fixture();
  t.after(f.dispose);
  const conversation = f.store.createConversation(SCOPE, { title: "reopen" });
  f.store.close();
  const reopened = new PlatformStore({ filename: f.filename });
  assert.equal(
    reopened.getConversation(SCOPE, conversation.id).title,
    "reopen",
  );
  reopened.close();
  assert.throws(
    () => f.store.createConversation(SCOPE, { title: "closed" }),
    expectCode("INTERNAL_ERROR"),
  );

  const futurePath = join(
    tmpdir(),
    `A008-platform-future-${process.pid}-${Date.now()}.sqlite`,
  );
  const database = new Database(futurePath);
  database.exec(
    "CREATE TABLE A008_platform_schema (singleton INTEGER PRIMARY KEY, version INTEGER NOT NULL)",
  );
  database
    .prepare(
      "INSERT INTO A008_platform_schema(singleton, version) VALUES (1, 2)",
    )
    .run();
  database.close();
  const before = readFileSync(futurePath);
  t.after(async () => rm(futurePath, { force: true }));
  assert.throws(
    () => new PlatformStore({ filename: futurePath }),
    expectCode("INVALID_REQUEST"),
  );
  assert.deepEqual(readFileSync(futurePath), before);
  const inspect = new Database(futurePath, { readonly: true });
  assert.equal(
    (
      inspect
        .prepare("SELECT version FROM A008_platform_schema WHERE singleton = 1")
        .get() as { readonly version: number }
    ).version,
    2,
  );
  inspect.close();
});
