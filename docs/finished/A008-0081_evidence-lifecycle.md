# L2 evidence lifecycle

Task ID: A008-0081
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-08
Last updated: 2026-09-08
Charter frozen at: 2026-09-08

## Read First

Read AGENTS.md and its ordered documentation, ADR 0018 and ADR 0035,
the knowledge constitution and the frozen instruction/memory specification.

## Task Summary

The owner accepted L1 and authorized L2. ADR 0035 has already accepted P1-P5.
The existing linear lifecycle and automatic restatement writes do not meet
that target: they lack operational baselines and durable occurrence receipts.

## Task Charter

### Goal

Implement the accepted L2 evidence lifecycle without changing truth ownership.

### Primary Deliverable

Per-claim severity with lazy exponential decay and exact, source-supported,
transactional reinforcement in the in-memory and SQLite knowledge engines.

### In Scope

- ML-01-06 and RF-01-04, accepted P1-P5, including creation policy snapshots.
- Existing analyzer/staging, comparator target mapping, live commit, lifecycle,
  operational clocks, read/inspection and SQLite transaction/migration owners.
- Runtime preferences validation and serialization of advanced lifecycle policy.
- Versioned legacy conversion, recovery evidence and old-binary rejection.
- Relevant tests and owning documentation, archive and handoff.

### Out of Scope

- L3 association lifecycle, edge storage or propagation.
- Retrieval/scaling redesign, ranking weights, domains/tags redesign, sweeps.
- New model calls, dependencies, policy GUI, provider tests or releases.
- Reopening the frozen specification body or changing L1's instruction contract.

### Definition of Done

- A09-A24 and claim-side A29-A30 have executed evidence, including restart,
  duplicate/concurrent occurrence, rollback and migration cases.
- L1 A01-A08 and preservation constraints B01-B04 remain satisfied.
- Typecheck, core, membership and GUI regression suites pass.
- Documentation distinguishes implemented L2 from deferred L3; frozen body hash
  remains a7f32b601a6d26cceeaaad3cf6b45f362c97d9b04bb5b5286c0fbfaa57c56a5a.
- Final necessity review, immutable archive, handoff and current-task restoration.

### Necessity Gate

Contract: docs/PROJECT_BRIEF.md, Core Product Contract
Contract revision: 736463dd2998d71fa004161ed22f374d6108b51f

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Creation and decay | PC-04; ADR 0035 P1/P2/P5, ML-01-05 | Persistence reflects importance and elapsed time; otherwise stale stored activation survives indefinitely | Validated analyzer enum, stored numeric policy and operational baseline, pure evaluation | A09-A13, A19-A22; fixed clocks |
| Exact recurrence | PC-04/05; ADR 0035 P3, RF-01-04 | Only new attributable evidence boosts the resolved claim; otherwise echoes and retries strengthen unrelated evidence | Existing comparator support proof and canonical handle map; occurrence/target receipts inside existing transaction owner | A14-A18, claim A29; duplicate, cancellation and failure fixtures |
| Durable upgrade | PC-04/06; ADR 0035 P4 | Existing evidence survives without invented severity or age; otherwise upgrade changes activation or loses receipt protection | Versioned atomic SQLite conversion and explicit compatibility rejection; documented backup/restore | A20/A23/A24; multi-namespace legacy and interrupted upgrade fixtures |
| Read preservation and inspection | PC-02/03/06; ML-06, B01-B04 | Dormant direct evidence remains discoverable and inspection explains evaluated state; otherwise global filtering hides evidence or reads refresh it | Pass one operation time through existing read owners; expose baseline and evaluated lifecycle separately | A14/A20/A21, L1 and full regression suites |
| Documentation and verification | PC-04; evidence discipline and frozen target | Handoff can distinguish actual behavior from plans | Update existing owners and record executed acceptance evidence | A30, frozen hash and changed-link review |

### Minimum Verification Gates

- [x] A09-A24 and claim-side A29-A30, in-memory and SQLite/restart as applicable.
- [x] L1/preservation regression, typecheck, core, membership and GUI suites.
- [x] Frozen specification hash, final necessity and documentation review.

## References

- [Frozen target](../backlog/instruction-plane-and-memory-lifecycle.md)
- [Accepted amendment](../adr/0035-frozen-instruction-and-memory-target.md)
- [Product contract](../PROJECT_BRIEF.md)

## Checklist

- [x] Read authority and inspect current lifecycle and write path.
- [x] Claim identity on main before Ready.
- [x] Implement policy, pure lifecycle evaluation and explicit migration.
- [x] Implement source support, exact target mapping and atomic receipts.
- [x] Connect operation snapshots, read and inspection.
- [x] Execute acceptance and regression checks; update owning documentation.
- [x] Archive, handoff, restore current task and integrate authorized work.

## Decisions and Notes

- No new owner policy decision is required: ADR 0035 accepts P1-P5.
- Use synchronous SQLite transactions after asynchronous semantic comparison;
  reload persisted state inside the transaction and validate the exact target.
- Preserve the existing v0 compatibility engine; L2 owns knowledge evidence.
- No private screenshot or runtime conversation is used as a published fixture.
- Approach refinements within the frozen gate: canonical restatement reuse and
  creation-occurrence dedup; reuse original attributed source evidence; SQLite
  local/data revision checks avoid stale namespace replacement without refreshing
  in-memory state on every unchanged operation. No charter outcome was added.

## Charter Amendment Log

- none

## Verification

Executed on 2026-09-08 against the final implementation:

- `npm run typecheck` and `npm run build`: passed.
- `npm run test:core`: 511 passed, 0 failures/skips, including the ten L2 groups.
- `npm run test:membership`: 4 passed; the new file is in the core manifest.
- `npm run test:gui`: 116 passed, 0 failures/skips.

| Acceptance | Executed evidence |
| --- | --- |
| A09 | Per-claim enum, invalid/missing enum rejection, mixed batch/raw carrier and ignored model numbers in lifecycle-v1. Existing staging/coordinator fixtures now supply the required enum. |
| A10-A13 | Fixed day 0/14/28/90/180/365 clocks; equality active, cap refresh, 0.1 decay then 0.3 boost, crossing horizon, small boost remaining dormant. |
| A14/A20 | Repeated inspection and snapshot equality; no baseline/receipt/log mutation; reopen at day 42 yields the uninterrupted effective value and exposes baseline/evaluation fields. |
| A15-A17 | Exact target and restatement/extend; new/supersede/conflict and unresolved target; answer-only, question/quotation decisions; original source attribution and same locator/content reimport. |
| A18/A29 | In-memory and SQLite rollback/cancellation, duplicate creation, duplicate occurrence/claim receipt, independent connection delivery, restart/retry and context isolation. Migration fixture also retains a second namespace. |
| A19 | Invalid numeric/time/policy inputs, lambda zero, zero strength, underflow and backward-clock baseline monotonicity. |
| A21 | Lazy dormant direct claim remains eligible; associative-only neighbor omitted; zero-strength pinned evidence active. Existing state/history and direct-score scenarios also pass. |
| A22 | Runtime preference change during an operation, subsequent creation, baseline policy retention, and older client saves preserving advanced policy. |
| A23/A24 | Multi-namespace legacy fixture with unknown time and zero threshold; transaction trigger failure and retry; version not advanced on failure; prior published store implementation executed against upgraded fixture and rejected it; SQLite backup restored and upgraded losslessly. |
| A30/B01-B04/L1 | Final source/docs diff and full regression suites: no edge lifecycle, ranking/weight/domain changes, universal active filter, background jobs, new provider calls/dependencies or L1 instruction changes. |

The migration failure test injects SQLite failure; restart tests reopen the file.
No physical power-loss test, live/paid semantic evaluation, user-database
migration, application restart, packaged distribution rebuild or deployment was
performed. Those are not evidence supplied by these offline tests.

Final necessity review: all new behavior maps to the five frozen gate rows.
The shared snapshot module and SQLite revision check are necessary to roll back
whole live commits and prevent stale connection writes from losing receipts;
no separate persistence framework was introduced. Canonical restatement reuse
and creation-occurrence dedup prevent retries from manufacturing fresh copies.
The existing explicit maintenance APIs retain their documented units and do not
provide automatic read-driven strengthening. The benchmark changes only its
synthetic analyzer enum. Package metadata changes only core-suite membership.

Frozen specification body, charter boundaries, previous immutable records,
current-task template, changed-document links/fences, UTF-8, credential-pattern
and diff checks are verified as part of the integration review.

## Documentation Updates

- [x] CURRENT_STATUS, SYSTEMDOC, knowledge constitution, JOURNAL and FILESTRUCTURE.
- [x] Collection indexes, completed archive and handoff.

## Handoff and Follow-ups

- Current state: L2 implemented and verified; ready for authorized integration.
- Next recommended step: separately activate L3 when requested; use the documented backup procedure before opening user data with the new build.
- Blockers: none.
- Child tasks: none.
- Resume condition: this record and the frozen target suffice.
- Open questions: none requiring a direction decision.

## Finalize When Complete

- Archive under docs/finished, restore CURRENT_TASK and write a handoff.
- Journal the verified integration on main.
