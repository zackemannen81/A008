# L3 independent association lifecycle

Task ID: A008-0082
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

The owner verified L2 and authorized L3. Accepted P6 now needs an independent
semantic association lifecycle and its selected one-hop consumer. Existing links
have neither numeric policy nor occurrence receipts; reading them is not proof.

## Task Charter

### Goal

Implement the accepted L3 association lifecycle without transferring persistence
to evidence endpoints or establishing truth/current state.

### Primary Deliverable

Source-supported, canonically resolved association metadata alongside the existing
relation index, persisted atomically and consumed by one-hop expansion.

### In Scope

- RS-01/02 and accepted P6, with the P2 edge policy and RF-03 receipt rules.
- Existing semantic comparator and entity registry: runtime handles resolve exact
  endpoints; independently supported relation decisions use the existing call.
- Directed identity: namespace plus canonical from/to IDs, semantic relation and
  canonical applicability scope; no binding interval identity or inferred symmetry.
- Existing relation index, operation snapshots, SQLite transaction/migration owner,
  one-hop associative eligibility and existing inspection detail.
- Legacy links remain untracked until valid evidence establishes their exact edge.
- Acceptance tests, owning documentation, archive, handoff and authorized integration.

### Out of Scope

- Retrieval/scaling redesign, new scoring, recursive propagation or background jobs.
- Automatic promotion of co-occurrence, domains, display or provenance links.
- Changes to claim acceptance, confidence, state bindings, conflicts or world clocks.
- New model calls/dependencies, policy GUI, live/paid calls, releases or deployment.
- User database migration, application restart, the owner's logo CSS changes.
- Changes to the frozen specification body or L1/L2's accepted contracts.

### Definition of Done

- A25-A30 have executed evidence for exact identity/proof, decay/thresholds,
  independent receipts, route preservation, rollback/restart/concurrent delivery.
- Versioned transactional legacy upgrade and backup/restore preserve existing
  namespaces and lifecycle baselines; incompatible binaries reject the new schema.
- Typecheck, core, membership and GUI regressions preserve L1/L2 and B01-B04.
- Final necessity review, durable docs, immutable archive and handoff are complete;
  CURRENT_TASK is restored and the authorized change is integrated on main.
- Frozen body SHA-256 remains
  a7f32b601a6d26cceeaaad3cf6b45f362c97d9b04bb5b5286c0fbfaa57c56a5a.

### Necessity Gate

Contract: docs/PROJECT_BRIEF.md, Core Product Contract
Contract revision: d867226ff0fc35047150b2ab7a206fbe598e57f5

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Independent edge owner | PC-02/04; ADR 0035 P6, RS-01/02 | Relation recurrence controls associative persistence; otherwise endpoints or old timeless links stand in for edge evidence | Scoped directed metadata and separate receipts/audit alongside RelationIndex; shared pure decay arithmetic | A25/A28/A29; exact/reverse/scope/endpoint fixtures |
| Semantic source proof | PC-04/05; RF-03, P3/P6 | Only new evidence for the resolved edge writes strength; otherwise traversal, echoes and retries manufacture support | Extend existing comparator output with exact handles and edge-specific source spans; validate inside existing atomic commit and skip/report unresolved edges | A25/A26/A28/A29; source/claim/edge independence, cancellation and stale targets |
| Policy and durability | PC-04/06; P2/P4/P6 | Numeric baselines and receipts survive upgrades/restarts; otherwise policy changes or duplicate delivery alter old history | Existing runtime policy snapshot and versioned SQLite migration; legacy links retain untracked behavior | A29; migration rollback, old snapshot/binary, backup/restore and namespaces |
| One-hop consumer and inspection | PC-02/03/06; ML-06/P6 | Dormant edges cannot volunteer neighbors while direct/alternate routes survive; otherwise dormancy has no useful effect or suppresses valid recall | Evaluate edge at one operation time before admission; existing inspection exposes baseline and effective state | A26/A27; equality/after threshold, alternate/direct paths, endpoint eligibility, no read writes |
| Documentation and regression | PC-04; evidence discipline, A30/B01-B04 | Handoff describes actual behavior with preserved L1/L2 authority | Update existing owners and record acceptance results, frozen/hash and CSS preservation checks | A30; full regression and final diff review |

### Minimum Verification Gates

- [ ] A25-A30 fixed-clock, in-memory and SQLite evidence as applicable.
- [ ] Legacy conversion, failure/retry, restart, concurrency and recovery checks.
- [ ] Typecheck, core, membership and GUI suites; L1/L2/B01-B04 preservation.
- [ ] Frozen body, charter boundary, final necessity and documentation review.

## References

- [Frozen target](../backlog/instruction-plane-and-memory-lifecycle.md)
- [Accepted amendment](../adr/0035-frozen-instruction-and-memory-target.md)
- [Product contract](../PROJECT_BRIEF.md)

## Checklist

- [x] Read authority and inspect existing semantic/index/storage/read owners.
- [x] Claim identity on main before Ready.
- [ ] Implement independent edge identity, policy, metadata and durable receipts.
- [ ] Connect source proof and exact semantic resolution in the existing call.
- [ ] Connect one-hop eligibility and inspection without read writes.
- [ ] Execute acceptance/regression checks and update owning documentation.
- [ ] Archive, handoff, restore current task and integrate authorized work.

## Decisions and Notes

- P6 is accepted; no new owner direction decision is needed.
- No relation definition currently declares symmetry; keep all edges directed.
- Existing claim candidate handles and registry entity handles remain runtime-owned.
  A proposal handle may resolve only to its actual committed canonical claim.
  Unresolved endpoints are skipped; associations never manufacture endpoints.
- Applicability scope comes from the staged operation, not a model-created scope.
- SQLite reload/revalidation occurs after asynchronous comparison, within the same
  transaction as claim/edge records, receipts and audit. Each has independent proof.
- The owner's d867226 logo CSS change is the baseline and remains untouched.

## Charter Amendment Log

- none

## Verification

Pending implementation and executed evidence. No live or user-data claim is made.

## Documentation Updates

- [ ] CURRENT_STATUS, SYSTEMDOC, knowledge constitution/process/storage owners.
- [ ] JOURNAL, FILESTRUCTURE, collection indexes, archive and handoff.

## Handoff and Follow-ups

- Current state: Ready; identity claim published on main.
- Next step: bounded implementation and verification of L3.
- Blockers: none.
- Child tasks: none.
- Resume condition: this charter and frozen target suffice.
- Open questions: none requiring a direction decision.

## Finalize When Complete

- Archive under docs/finished, restore CURRENT_TASK and write a handoff.
- Journal the verified integration on main.
