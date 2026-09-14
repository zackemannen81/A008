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
| 2. Project/session ownership | Not started | Explicit existing-data attachment, compatible v1/ACP |
| 3. V2 and auth | Not started | Precise accepted wire/security decision before code |
| 4. Turns and recovery | Not started | Snapshot boundary, idempotency, cancellation/restart proof |
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
stage-1 V2 decision gate. No V2/auth, ownership/recovery redesign,
SDK migration or Expo proof has been delivered yet.

A008-0106 closes the stage-1 decision gate through ADR 0041 and CLIENT_API_V2.md.
The owner authorized autonomous remaining decisions/tasks and per-task push/PR/merge.
No later implementation stage is complete merely because its design is decided.
