# A008-0102 — Host-client API boundary plan

Task ID: A008-0102
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-14
Last updated: 2026-09-14
Charter frozen at: 2026-09-14

## Goal
Produce a code-grounded plan for making A008's existing host protocol a stable,
client-independent product boundary before an Expo/Tauri client is built.

## Primary Deliverable
A proposed plan at docs/backlog/host-client-api-boundary.md with verified gaps,
recommended contract, staged migration, dependencies, gates and explicit limits.

## Scope
Read the current host/engine/GUI protocol, schemas, ownership and recovery behavior.
Describe contract ownership, versioning, errors, auth, project/session addressing,
stream/recovery semantics, client SDK, compatibility and an independent-client proof.

## Out of Scope
Protocol/runtime/UI/database implementation, native app construction, adoption of
proposed ADR changes, new provider calls or deployment beyond the separately
completed A008-0101 owner-authorized integration and host restart.

## Definition of Done
Observed behavior and proposed behavior are distinguished; each implementation
slice has concrete dependencies and acceptance checks. Existing supported clients
have a migration path. No new product promise is presented as implemented.
Plan, index, archive and handoff exist; CURRENT_TASK is restored.

## Necessity Gate
Contract revision: bbd4372 (PROJECT_BRIEF unchanged from dfea58e).
PC-01 — One shared engine; PC-04 — Durable knowledge with runtime authority;
PC-05 — Explicit execution and credential boundaries; PC-06 — Supported controls.
Accepted constraints: ADR 0018, 0019, 0028, 0029 and 0037; HOST_PROTOCOL/ENGINE.
The owner requests a plan for independently implemented clients. Without this
bounded investigation, a new client would inherit GUI-specific auth, global
workspace selection and implicit transport/session assumptions. The smallest
sufficient deliverable is a source-grounded proposed contract/migration plan,
not a framework rewrite. Verification: source mapping, operation ownership,
compatibility and executable acceptance criteria for each proposed slice.

## Verification Gates
- Review existing HTTP/WS parser, client, host/engine ownership and protocol docs.
- Distinguish proposals requiring an ADR amendment from existing guarantees.
- Review all slices against the contract; no IDs allocated to hypothetical work.
- Document links/fences, diff check, current-task template identity.

## Decisions and Notes
Use a same-owner server plus multiple client types as the planning assumption.
Do not infer multi-tenancy, durable conversation history, offline sync or a
Postgres migration from the request. Recommend bounded defaults and identify
product decisions without blocking this written plan.

## Verification
- Reviewed actual host/client wire parsers, HTTP route ownership, SessionSnapshot,
  standalone workspace replacement, engine project/session registries and auth.
- Reviewed HOST_PROTOCOL, ENGINE and ADR 0019/0028/0029/0037 ownership/recovery
  obligations; existing behavior and proposed V2 guarantees are separate.
- The plan includes explicit existing-store attachment, same-runtime ownership,
  credentials, bounded idempotency, snapshot/event ordering, partial memory-write
  outcomes, v1/ACP compatibility and an independent installed-package client proof.
- Each of seven proposed stages has dependencies and observable acceptance gates.
- Necessity review passes PC-01/04/05/06 for bounded planning; no new product policy
  was adopted and no runtime/schema/client implementation was performed.
- Primary specification/platform links support schema/WS guidance.
- Documentation links/fences, template byte identity and diff checks passed.
- Runtime tests were not repeated for docs-only changes. Prior A008-0101 rollout
  and actual host health/auth verification are recorded separately in JOURNAL.

## Deliverable and Handoff
- Proposed plan: docs/backlog/host-client-api-boundary.md, indexed in backlog README.
- Handoff: docs/handoffs/A008-0102.md.
- Next implementation: inventory/consolidate v1 contracts and fixtures without
  behavior change; activate through a new charter rather than this finished plan.
- CURRENT_TASK restored to the template. Plan remains proposed, not an accepted ADR.
