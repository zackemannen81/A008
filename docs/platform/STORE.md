# PlatformStore

`PlatformStore` is the local SQLite owner for the first `/v3` platform slice.
It persists scoped conversations, committed user/assistant messages, runs,
command receipts and body-free outbox events. It has no HTTP surface, scheduler,
provider execution, semantic-memory access or process-lifetime lock.

The store accepts a trusted backend `PlatformScope` on every operation:

```ts
interface PlatformScope {
  tenantId: string;
  projectId: string;
  principalId: string;
}
```

The backend supplies that scope after authentication and authorization. IDs never
grant or infer scope. Conversation creation uses the existing canonical
`RuntimeIdentityFactory.create("conversation")` format unless the caller provides
an already-valid canonical conversation ID. Run, command and message IDs remain
opaque values in this store.

## Construction and reads

```ts
const store = new PlatformStore({ filename: "C:/data/a008-platform.sqlite" });

const conversation = store.createConversation(scope, { title: "Investigate" });
const current = store.getConversation(scope, conversation.id);
const conversations = store.listConversations(scope);
const run = store.getRun(scope, runId);
const queued = store.listRuns(scope, { statuses: ["queued"] });
const page = store.readEvents(scope, { after: 0, limit: 100 });
store.close();
```

`readEvents` uses a scoped monotonic integer cursor, accepts a page limit from 1
through 1000 (default 100), and returns `{ events, nextCursor, hasMore }`.
Scoped pages may have cursor gaps. The first snapshot is bounded to 10,000
messages; `acceptRun` reserves space for both its user message and eventual
assistant answer, and rejects admission with `CAPACITY_EXCEEDED` when it cannot.
`listRuns` is a scoped status inspection for recovery and queue views. It is
intentionally unpaged and does not establish admission, scheduler or capacity
limits.

## Mutations and leases

```ts
const accepted = store.acceptRun(scope, {
  conversationId: conversation.id,
  commandId: "opaque-client-command",
  expectedRevision: conversation.revision,
  model: "configured-model",
  text: "Summarize the plan.",
  memoryRequested: true,
});
// Same tenant/principal/commandId plus the identical canonical payload:
// { run: accepted.run, replayed: true }, before busy or revision checks.

const claimed = store.claimRun(scope, {
  runId: accepted.run.id,
  ownerToken: "worker-instance-token",
  leaseDurationMs: 30_000,
});

const dispatched = store.recordDispatch(scope, {
  runId: claimed.run.id,
  ownerToken: claimed.lease.ownerToken,
  generation: claimed.lease.generation,
  expectedRevision: claimed.run.revision,
});

const complete = store.commitAnswer(scope, {
  runId: dispatched.id,
  ownerToken: claimed.lease.ownerToken,
  generation: claimed.lease.generation,
  expectedRevision: dispatched.revision,
  content: "The persisted answer.",
});

store.recordMemoryOutcome(scope, {
  runId: complete.id,
  expectedRevision: complete.revision,
  status: "completed",
});
```

Public mutation signatures are:

```ts
createConversation(scope, input): PlatformConversation
acceptRun(scope, input): { run: PlatformRun; replayed: boolean }
claimRun(scope, input): { run: PlatformRun; lease: PlatformLease }
renewLease(scope, input): PlatformLease
recordDispatch(scope, input): PlatformRun
commitAnswer(scope, input): PlatformRun
failRun(scope, input): PlatformRun
requestCancel(scope, input): PlatformRun
confirmCancellation(scope, input): PlatformRun
recordMemoryOutcome(scope, input): PlatformRun
recoverExpiredLeases(scope): readonly PlatformRun[]
```

The coordinator-facing arguments are deliberately small and exact:

```ts
new PlatformStore({ filename, clock?, identityFactory?, idFactory?, database? })

acceptRun(scope, {
  conversationId, commandId, expectedRevision, model, text,
  runId?, messageId?, memoryRequested?
})
claimRun(scope, { runId, ownerToken, leaseDurationMs })
renewLease(scope, { runId, ownerToken, generation, leaseDurationMs })
recordDispatch(scope, { runId, ownerToken, generation, expectedRevision })
commitAnswer(scope, { runId, ownerToken, generation, expectedRevision, content, messageId? })
failRun(scope, { runId, ownerToken, generation, expectedRevision, error: { code, message } })
requestCancel(scope, { runId, expectedRevision })
confirmCancellation(scope, { runId, ownerToken, generation, expectedRevision })
recordMemoryOutcome(scope, { runId, expectedRevision, status })
recoverExpiredLeases(scope)
readEvents(scope, { after?: number, limit?: number })
```

`clock` returns a nonnegative epoch-millisecond safe integer. `leaseDurationMs`
is a positive safe integer. `ownerToken` is the worker-owned opaque lease token;
`generation` is the store-issued fencing value returned by `claimRun` and never
selected by a caller. `recordDispatch` has no provider payload: it durably marks
the boundary before external execution. `commitAnswer` takes only canonical chat
content and has no raw response or reasoning field. Recovery receives only its
trusted scope and uses the store clock; it never accepts a client-selected
recovery outcome.

`acceptRun` is one immediate SQLite transaction: it checks a matching command
receipt first, then validates the conversation revision and one nonterminal
writer, appends the user message, creates the queued run and receipt, and writes
outbox notifications. No failed acceptance leaves a partial message, run or
event.

Lease writes require the owner token, increasing generation, unexpired lease and
expected run revision. `recordDispatch` marks the effect `unknown` before the
external boundary. `recoverExpiredLeases` requeues only running work with no
recorded dispatch; an expired pre-dispatch cancellation becomes `cancelled`,
while dispatched work moves to `needs_reconciliation`. It never replays an
unknown effect. A stale worker receives `LEASE_LOST`.

Queued cancellation is terminal immediately. A running cancellation becomes
`cancel_requested`, which is only a request: the lease holder can still commit a
known answer guarded by the new revision, or confirm cancellation when no
unknown effect was recorded. Unknown dispatched work stays
`needs_reconciliation`; the first slice has no verified-stop input and never
converts that uncertainty to `cancelled`. Whichever revision-controlled terminal
transition commits first is the only winner.
`commitAnswer` atomically appends the assistant message, updates conversation
revision, completes the run and emits outbox events. Memory status is recorded
later and independently, so a failed memory outcome cannot regenerate or remove
the answer.

The database rejects a future schema version before a store instance is usable.
After `close()`, mutating methods reject with `PlatformStoreError`; a closed
store has no implicit reopening behavior.
