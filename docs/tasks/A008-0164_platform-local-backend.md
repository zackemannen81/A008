# A008-0164 — Local platform backend integration

Task ID: A008-0164
Parent Task: A008-0160
Status: Draft
Owner: Codex (operator; delegate after prerequisites)
Created: 2026-09-22

## Draft outcome

Compose A008-0161 durable storage, A008-0162 V3 contract and A008-0163 trusted
history with current project runtime and authentication in the actual GUI host.
Client disconnect cannot cancel accepted work. Preserve all V1/V2 behavior.

## Dependencies / unresolved before Ready

0161/0162/0163 must be merged; inspect bounded public API handoffs.
Freeze exact store/coordinator methods, error mapping, shutdown and reconciliation
API, process-lock path and capability advertisement once actual dependencies exist.
No implementation or delegation of this Draft.

## Proposed scope

New src/platform/coordinator.ts, runtime-adapter.ts and local configuration;
new src/gui-host/platform-v3-http.ts; bounded server.ts composition; test and
process fixture; package.json test registration. Client SDK remains A008-0165.
Existing runtime source edits require explicit coordination with 0163 owner.

## Required acceptance to freeze

- Real authenticated HTTP accepts once, scoped receipt replays without new call,
  payload/revision/busy conflicts preserve state, oversized input fails pre-dispatch.
- One server-owned local tenant and project-scoped authorization; no authority
  from request body. Read authorization before exposing resource existence/content.
  Existing V2 app credentials can be reused with explicit capability mapping;
  possession of model key is never app auth. Recheck principal before dispatch.
- Dedicated persistent file independent of memory mode, outside repo; exclusive
  backend process owner. Do not silently migrate old chats. Safe bind failure cleanup.
- Separate conversations/projects execute concurrently with finite capacity;
  state survives all observers disconnecting. Bounded authenticated event polling.
- Backend-reconstructed canonical history reaches existing memory/provider pipeline
  with the accepted input appended once; no old-message semantic replay.
- First slice may disable tools explicitly; do not pretend durable approval is
  implemented. No second model/cognition implementation.
- Known completed answer and memory outcome separate; memory failure never causes
  provider replay. Lease loss/timeout/cancel cannot fabricate no-effect status.
- Stop/new-dispatch fence before shutdown; dispatched unknown blocks on restart;
  safe queued work survives. Real OS-process crash/restart acceptance test.
- Same SDK consumes actual host where available; provider wire unchanged so
  deterministic loopback proves composition, not real external provider capability.
- Failures produce sanitized typed errors; no raw reasoning/credential persistence.
- Current runtime/host/V1/V2 regression and appropriate package/integration gates.

## Necessity / budget

PC-07 durable background work plus PC-01/04/05 existing owners; ADR 0048.
Budget pending freeze; planned loopback tests need 0 paid/live calls. Any later
actual provider smoke receives explicit allocation from program budget.

## Operator integration decisions prepared for Ready

These choices become execution authority only when this charter is frozen Ready
after prerequisite acceptance. They refine the existing first-slice contract.

- Composition is opt-in through `GuiHostOptions.platformPath` or
  `A008_PLATFORM_PATH`. Without it, public `/v3/info` reports unavailable and no
  platform database is opened. Existing V1/V2 installations/tests remain unchanged.
  With it, require an absolute canonical persistent path outside the repository,
  distinct from semantic memory storage. Hold existing `acquireRuntimeLease`
  with platform namespace for the process lifetime; no second lock mechanism.
- Tenant is the fixed backend-owned local identity `local`; existing V2 PIN or
  device authentication is required for every resource route. Map the `session`
  capability to this first text-only surface and recheck it before dispatch and
  during active work. Resource lookup only searches registered, authorized
  projects; foreign/unknown resource IDs return indistinguishable NOT_FOUND.
- Reconstruct queued-run principal authority using the stored server-issued
  principal ID and current DeviceRegistry/current PIN configuration, never a
  persisted bearer credential or client-supplied grant. Revoked/expired/missing
  authority cannot dispatch. The configured local owner browser identity is
  valid only while the host PIN profile remains enabled.
- Use PlatformStore as the sole durable owner and its lease-issued generation.
  Coordinator runtime state is replaceable. Scan registered project scopes on
  startup and periodically, so work from another principal need not wait for
  that observer to reconnect. Pending safe work survives restart; unknown work
  remains blocked. No public reconciliation mutation in this task.
- Default maximum active runs is 4, queued/nonterminal admission 100 per project
  and 256 across this local backend; replayed commands are not new admission.
  Bound configurable overrides with validation. One conversation writer remains
  enforced by the store. Registered projects keep their existing cwd/memory binding.
- Use 30-second run leases renewed every 5 seconds, a bounded 120-second turn
  timeout and a bounded shutdown drain. Stop admitting/dispatching before abort;
  do not close shared runtimes underneath active callbacks. Dispatched failures
  with unknown outcome remain fenced until lease recovery; never call them safe
  failures/cancellations. Verify post-output pending state after process recovery
  is marked unknown without re-running either provider work or memory intake.
- Runtime adapter uses the already-owned project runtime and
  `openSession({ model, conversationSeed })`, followed by exactly one `turn` for
  the newly accepted message. Seed excludes that run's newly appended user
  message. No `prepareTools` or tools are supplied; advertise text-only execution.
  Validate registered model before accepting new work, and again before dispatch.
- If turn throws after appending a committed assistant message, preserve only
  that newly committed answer and mark memory failure separately. Establish it
  by before/after committed history, never last-seed-message or streamed tokens.
  If no new committed assistant exists, do not infer a known provider outcome.
- Apply existing same-origin protection, a 1 MiB JSON request body limit and
  65,536 UTF-8 byte prompt limit before admission. Validate all V3 DTOs and output.
  Bound response bytes to 8 MiB; return a typed capacity error instead of partial
  snapshots. No raw exceptions, bearer credentials or reasoning in durable errors.
- HTTP errors: 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND; 400
  INVALID_REQUEST; 409 revision/busy/command/lease/reconciliation conflicts;
  429 CAPACITY_EXCEEDED; 500 INTERNAL_ERROR. Successful JSON operations return
  200 (including admission/replay); info never leaks user configuration.
- Available capabilities name only delivered durable conversations/runs,
  command receipts, event polling, background text runs and restart uncertainty.
  No tools, approvals, migration, reconciliation resolution or multi-tenant claim.

### Required real integration fixture

Use actual startGuiHost, temp stores/projects/device grants and the existing
loopback session-control provider (or bounded extension of it). Inject deterministic
provider behavior, not fake durable storage/auth/HTTP. Assert real SDK/HTTP history
and events, two projects progressing concurrently, two conversations in one
project, same-revision race, dropped-response receipt recovery, observer close,
revocation before dispatch, cancellation/answer and memory-failure separation.
Run a real child Node host process; kill it after dispatch and restart against
the same files. The result is needs_reconciliation, never a second provider call.
Also prove queued safe work recovery, exclusive process lock and bind-failure
cleanup. Keep all fixture paths/credentials local to temp directories.
