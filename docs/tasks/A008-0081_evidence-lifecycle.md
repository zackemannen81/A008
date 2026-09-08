# L2 evidence lifecycle

Task ID: A008-0081
Parent Task: None
Status: Ready
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

- [ ] A09-A24 and claim-side A29-A30, in-memory and SQLite/restart as applicable.
- [ ] L1/preservation regression, typecheck, core, membership and GUI suites.
- [ ] Frozen specification hash, final necessity and documentation review.

## References

- [Frozen target](../backlog/instruction-plane-and-memory-lifecycle.md)
- [Accepted amendment](../adr/0035-frozen-instruction-and-memory-target.md)
- [Product contract](../PROJECT_BRIEF.md)

## Checklist

- [x] Read authority and inspect current lifecycle and write path.
- [x] Claim identity on main before Ready.
- [ ] Implement policy, pure lifecycle evaluation and explicit migration.
- [ ] Implement source support, exact target mapping and atomic receipts.
- [ ] Connect operation snapshots, read and inspection.
- [ ] Execute acceptance and regression checks; update owning documentation.
- [ ] Archive, handoff, restore current task and integrate authorized work.

## Decisions and Notes

- No new owner policy decision is required: ADR 0035 accepts P1-P5.
- Use synchronous SQLite transactions after asynchronous semantic comparison;
  reload persisted state inside the transaction and validate the exact target.
- Preserve the existing v0 compatibility engine; L2 owns knowledge evidence.
- No private screenshot or runtime conversation is used as a published fixture.

## Charter Amendment Log

- none

## Verification

- Pending implementation and executed checks.

## Documentation Updates

- [ ] CURRENT_STATUS, SYSTEMDOC, knowledge constitution, JOURNAL and FILESTRUCTURE.
- [ ] Collection indexes, completed archive and handoff.

## Handoff and Follow-ups

- Current state: Ready; implementation has not started.
- Next recommended step: implement L2 within this charter.
- Blockers: none.
- Child tasks: none.
- Resume condition: this record and the frozen target suffice.
- Open questions: none requiring a direction decision.

## Finalize When Complete

- Archive under docs/finished, restore CURRENT_TASK and write a handoff.
- Journal the verified integration on main.
