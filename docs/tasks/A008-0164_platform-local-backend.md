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
