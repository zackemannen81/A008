# Platform V3 first-slice contract

Status: Accepted
Owner: A008-0160 / ADR 0048
Boundary: schema and durable storage first; runtime/HTTP availability is separate.

## Identity and representation

Use camelCase JSON properties. IDs are nonempty opaque strings (max 256 chars);
tenant/project/principal authority is supplied by the backend, never mutation
payloads. Revisions/cursors are nonnegative safe integers; timestamps are
nonnegative integer epoch milliseconds. All new V3-owned wire objects reject
unknown fields. Messages reuse existing chatContentSchema exactly, including
its established nested content parsing/unknown-key semantics for compatibility;
no reasoning is persisted. This exception does not admit extra authority fields
on V3 resource or mutation objects.

Conversation:
- id, tenantId, projectId, title, createdAt, updatedAt, revision
- messages: array of { id, role: user|assistant, content, createdAt, runId? }
- title length 1..200; max message array 10000 for first bounded snapshot.

Run:
- id, tenantId, projectId, conversationId, principalId, commandId, model
- status: queued|running|cancel_requested|needs_reconciliation|succeeded|failed|cancelled
- revision, createdAt, updatedAt, leaseGeneration
- effectStatus: none|unknown|known
- answerStatus: pending|completed|failed|unknown
- memoryStatus: not_requested|pending|completed|failed|unknown
- error?: { code, message } (bounded strings; no secrets/payload)
- no raw provider response, thought stream, memory evidence or credential.

The initial statuses are an intentionally bounded executable subset. Waiting
for tools/approvals/context/targets is not advertised until implemented.

Command receipt:
- commandId, tenantId, principalId, operation: run.create
- payloadDigest (internal backend-computed SHA-256, not semantic identity)
- runId, createdAt

Event:
- cursor, tenantId, projectId, conversationId, runId? 
- type: conversation.created|run.queued|run.updated|conversation.updated
- resourceRevision, createdAt
- body-free change notification; clients fetch canonical resources.
No thought/reasoning events are persisted. Cursor is opaque in meaning but
represented as a monotonically increasing safe integer; scoped filtering may
produce gaps. Events and state transition commit in the same transaction.

## HTTP contract (not availability)

GET /v3/info: { protocolVersion: "a008.platform.v3", available: boolean,
  capabilities: string[] } — public metadata only; don't advertise before host wiring.
GET /v3/projects/:projectId/conversations: { conversations: Conversation[] }
POST /v3/projects/:projectId/conversations:
  body { title } → { conversation: Conversation }
GET /v3/conversations/:conversationId: { conversation: Conversation }
POST /v3/conversations/:conversationId/runs:
  body { commandId, expectedRevision, model, text } → { run: Run, replayed: boolean }
GET /v3/runs/:runId: { run: Run }
POST /v3/runs/:runId/cancel: body { expectedRevision } → { run: Run }
GET /v3/events?after=:cursor&limit=:limit&projectId=:id:
  { events: Event[], nextCursor: integer, hasMore: boolean }
text length 1..65536 chars plus host byte limit; model 1..256 chars.
Event limit 1..1000, default 100; snapshots and retrieval are bounded.
P1 first delivery may use authenticated incremental HTTP polling; WebSocket
fanout follows without changing durable resource authority.

Errors: { error: { code, message } }. Codes:
UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, INVALID_REQUEST, REVISION_CONFLICT,
CONVERSATION_BUSY, COMMAND_CONFLICT, CAPACITY_EXCEEDED, LEASE_LOST,
NEEDS_RECONCILIATION, INTERNAL_ERROR. HTTP mapping freezes with host adapter.

## Durable storage responsibilities

One platform SQLite database owns these records independently of memory mode.
Store methods accept a trusted {tenantId, projectId, principalId} scope supplied
by the backend. No scope inference from IDs. Unknown/foreign resources must
not leak data. Store schema version must reject future schemas without mutation.

Accept run atomically: compare conversation revision, enforce one nonterminal
writer, append user message, increment conversation revision, create queued run,
create scoped command receipt, append outbox events. Same tenant/principal/command
and same canonical operation payload returns the original run before revision
or busy checks. Changed operation/model/text/conversation/revision conflicts.
Client digest isn't trusted. Failed transactions leave no partial message/run/event.

Lease: owner token, expiry and increasing generation. Claim/renew/write/dispatch/
finish require current unexpired authority. Record dispatch before effect.
An expired undispatched run may requeue; dispatched uncertainty must block.
Old workers cannot append output, release a new lease or dispatch new work.
All terminal changes are revision-controlled; completion/cancellation race has
one accepted winner. Unknown effect never becomes safe cancellation by timeout.

Commit answer once, atomically with assistant message, conversation revision,
run status and outbox. Record memory outcome separately; don't regenerate an
answer because post-output memory failed. Do not implement semantic intake here.
Cancel queued work immediately; running cancellation requests must not claim
the external operation stopped. Reconciliation is explicit, not blind retry.

Keep receipts and nonterminal uncertainty in first release (no automatic GC).
Outbox reads use scoped cursors and bounded pages; rows survive reopen.
Closed databases reject writes. Use existing better-sqlite3, no new dependency.
