# A008-0103 — Stable client API program

Task ID: A008-0103
Parent Task: None
Status: In Progress
Owner: Codex (operator)
Created: 2026-09-14
Charter frozen at: 2026-09-14

## Frozen charter
Goal: implement the approved versioned independently consumable API and prove it
with the existing web client and a minimal independent Expo client.
Deliverable: the seven-stage plan implemented and verified, preserving v1/ACP
compatibility and existing project memory.
Authority: PC-01/04/05/06 at f4dffcd, unchanged by allocation 26e1609; ADR 0040
adopts docs/backlog/host-client-api-boundary.md with its recorded body hash.
Need: independent clients currently depend on GUI-specific contracts, auth and
global workspace behavior. Omission leaves clients coupled to internals.
Approach: staged adapters, shared contracts and SDK over existing runtime owners.
Verification: the plan's stage gates and independent installed-package proof.

Scope, exclusions and definition of done are the adopted plan. No database change,
multi-tenancy, durable conversation, offline sync or full native product. No
existing client silently breaks and no project silently receives empty memory.

## Stage checklist (mutable observed progress)
| Stage | Status | Child / next gate |
| --- | --- | --- |
| 1. Current contract | Complete | A008-0104/0105 merged; A008-0106 accepts V2/ownership/auth/recovery decisions |
| 2. Project/session ownership | Complete | A008-0107/0108/0109 shared registry, facade, exact binding and process ownership proof |
| 3. V2 and auth | Complete | A008-0110/0112: scoped device auth, tickets, authenticated WS dispatch and live revoke/expiry |
| 3.5 ACME execution evaluation | Complete; GO | A008-0118: `AcmeChatTransport` on `acme-model-runtime/2`; live chat matrix and owner client loop passed; images remain direct; Stage 4 may start |
| 4. Turns and recovery | In progress; A008-0132/0138/0139 complete; A008-0140 Ready | A008-0140 next: restart uncertainty + combined Stage-4 closure proof |
| 5. SDK and web migration | Not started | Independent package and complete web coverage |
| 6. Independent Expo proof | Not started | Real platform/remote auth and background-return checks |
| 7. Compatibility release | Not started | Frozen client vs compatible future server gate |

Only the active child belongs in CURRENT_TASK on its implementation branch.
Child completion does not imply program completion. Children archive evidence
and restore CURRENT_TASK. The operator updates this progress table.

## Verification
Plan frozen by ADR 0040 with normalized body hash. First child A008-0104 has
completed the session foundation: shared installed package, 90 compatibility
cases, actual host frames/models, full tests and portable engine proof pass.
A008-0105 completes the HTTP contract closure: 35 shared schema components,
generated OpenAPI, 52 legacy cases and all HTTP operations verified on a real
test host. Full tests and installed/portable package proofs pass. A008-0106 closes the
stage-1 V2 decision gate. No V2/auth, complete ownership/recovery redesign,
SDK migration or Expo proof has been delivered yet.

A008-0106 closes the stage-1 decision gate through ADR 0041 and CLIENT_API_V2.md.
The owner authorized autonomous remaining decisions/tasks and per-task push/PR/merge.
No later implementation stage is complete merely because its design is decided.

A008-0107 supplies the reusable runtime registry, strict existing-data attachment
and same-process ownership checks. It preserves engine/panel behavior. At that child's completion, stage 2 still required the facade and cross-process exclusion.

A008-0108 guards registry-backed engine processes, including first-open races
and crash release. At that child's completion, direct legacy runtime owners still required migration
or explicit exclusion. A008-0109 below completes that work.

A008-0109 completes stage 2: standalone uses the shared session facade, fixed
project bridges reject foreign sessions, borrowers retain independent sessions,
and direct CLI/ACP factories honor process leases. V1 lazy initialization remains
separate from strict existing attachment. V2 HTTP/WS/auth is the next stage.

A008-0110 supplies local hashed device credentials, scope/expiry/revocation,
shared schemas, public discovery and one-use tickets. V2 session/HTTP business
operations and live-socket revocation are not delivered. The owner requested
stopping at this completed-task boundary; do not allocate another child in this
run. Resume by reviewing ADR 0041/CLIENT_API_V2 and freezing the next stage-3
child on main. At that A008-0110 completion boundary, later stages 4 through 7 were still unstarted.

A008-0111 is a separate owner-requested prerequisite after the A008-0110 stop: Projects can now register/open an already-existing root without project-tree mutation or heuristic legacy-memory migration. It does not advance the stage-3 checklist.

A008-0112 completes stage 3: `/v2/session` authenticates one-use tickets on first frame, binds principal/project/session authority, dispatches session and tool-permission operations through the shared runtime owner, rechecks capability/expiry per operation and closes/cancels/denies on revoke or expiry. Stage 4 now owns sequence/snapshot boundaries, terminal turn outcomes, reconnect/resume and mutation idempotency.
A008-0114 completed the first Stage 3.5 evaluation against `acme-model-runtime/1` and recorded **NO-GO** because that wire could not carry A008 thinking/reasoning/topP/seed controls. A008-0118 consumes `acme-model-runtime/2`, maps those controls, and records **GO** after live chat matrix and owner client-loop evidence. Selection remains `A008_CHAT_TRANSPORT=acme`. Direct chat transports remain reference composition. Image/audio/video stay on their current owners. Stage 4 may start and must keep application `commandId`/`turnId`/event sequence distinct from ACME `modelExecutionId`.

A008-0132 completes the first Stage-4 child: V2 now owns stable application `turnId`/`messageId`, per-session monotonic sequence under one `serverInstanceId`, an ordered snapshot capture/drain boundary and exactly-one terminal turn settlement with separate answer/memory status. A008-0136 makes those implemented capabilities visible through `/v2/info` and a read-only bundled-GUI Runtime view; it does not migrate bundled chat to V2 or advance Stage 5. A008-0138 completes bounded command receipt/idempotency: stable mutation `commandId`, canonical payload digest, principal-scoped running/terminal receipts, same-command dedupe, payload conflict, five-minute/1,024-per-principal retention and authenticated lookup are verified without durable exactly-once claims. A008-0139 completes the same-process reconnect/resume slice: transport loss interrupts active work and approvals before a 45-second detached lease, an opaque scoped capability rebinds the same session, authoritative snapshot ordering is reused and no transient/model/tool work is replayed. A008-0140 is now the only remaining Stage-4 child: restart uncertainty plus the combined closure matrix.