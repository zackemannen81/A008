# A008-0164 — Local platform backend integration

Task ID: A008-0164
Parent Task: A008-0160
Status: Ready
Owner: Codex GPT-5.6 Terra (worker)
Created: 2026-09-22
Charter frozen at: 2026-09-22 after prerequisite integration f9ae0f5
Branch: codex/a008-0164-platform-local-backend
Clone: C:/code/A008-workers/A008-0164-platform-local-backend

## Goal and primary deliverable

Compose A008-0161 durable storage, A008-0162 V3 contract and A008-0163 trusted
history with current project runtime and authentication in the actual GUI host.
Client disconnect cannot cancel accepted work. Preserve all V1/V2 behavior.

## Accepted dependencies

0161/0162/0163 are merged at f9ae0f5. Read their bounded docs/platform contracts
and handoffs plus this charter, required repository authority and ADR 0048.
Use the actual PlatformStore methods and LocalMemoryRuntime seed; no guessed
dependency interfaces. SDK 0165 may integrate while this work runs; operator owns
the final SDK-versus-real-host proof if the SDK is unavailable at worker freeze.

## Write scope

New src/platform/coordinator.ts, runtime-adapter.ts and local-config.ts;
new src/gui-host/platform-v3-http.ts; bounded src/gui-host/server.ts composition;
test/platform-host.test.ts, test/fixtures/platform-host-process.ts and bounded
extensions of test/fixtures/session-control-provider.ts; package.json solely test
registration. src/platform/platform-store.ts may add the read-only receipt lookup
below with tests in test/platform-store.test.ts; no other store semantic changes.
docs/platform/BACKEND.md plus this task/current-task, unique finished archive and
handoff. Shared docs/indexes belong to operator integration in this same PR.
No protocol/client/GUI/memory/runtime-core changes, dependencies or lockfiles.
Report a blocker before changing these boundaries. No subdelegation.

## Required acceptance

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
0 SEK / 0 live product-provider calls. Real loopback HTTP/SQLite/process tests
verify platform composition, not external provider wire behavior. Existing
provider adapter is unchanged. No actual user stores or secrets are used in tests.

## Frozen integration decisions

These choices refine the existing first-slice contract; they do not redefine
cognition/memory or V1/V2 behavior.

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
- Add read-only `lookupRunReceipt(scope, acceptInput)` to PlatformStore using
  its existing canonical digest and receipt rules. Return an existing accepted
  run/replayed result or undefined; changed payload must conflict. Use it before
  new-run model/capacity checks, so an accepted command remains recoverable even
  if capacity is full or its model was removed. Reuse the same receipt logic in
  acceptRun; never duplicate digest semantics in the host. Authenticate and
  authorize before either operation.
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

## Minimum gates and handoff

Build, typecheck, focused platform-store/platform-host tests, existing v2-auth
and gui-host regressions and test membership must pass. Run full npm test before
final handoff; classify failures rather than silently omitting suites. Include
real-process proof and count provider requests independently of run state.
No checkpoint is accepted merely because a status field says succeeded.
Restore CURRENT_TASK byte-for-byte; archive completed charter; commit/push/open
and attach PR. Never merge. Provide exact base/head/PR, commands/pass counts,
fixture/local/live classification, remaining limitations, config/defaults and
the operator's exact global documentation deltas. User authorizes these Git
actions within this task; operator performs acceptance and integration.
