# L3 independent association lifecycle

Task ID: A008-0082
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

- [x] A25-A30 fixed-clock, in-memory and SQLite evidence as applicable.
- [x] Legacy conversion, failure/retry, restart, concurrency and recovery checks.
- [x] Typecheck, core, membership and GUI suites; L1/L2/B01-B04 preservation.
- [x] Frozen body, charter boundary, final necessity and documentation review.

## References

- [Frozen target](../backlog/instruction-plane-and-memory-lifecycle.md)
- [Accepted amendment](../adr/0035-frozen-instruction-and-memory-target.md)
- [Product contract](../PROJECT_BRIEF.md)

## Checklist

- [x] Read authority and inspect existing semantic/index/storage/read owners.
- [x] Claim identity on main before Ready.
- [x] Implement independent edge identity, policy, metadata and durable receipts.
- [x] Connect source proof and exact semantic resolution in the existing call.
- [x] Connect one-hop eligibility and inspection without read writes.
- [x] Execute acceptance/regression checks and update owning documentation.
- [x] Archive, handoff, restore current task and integrate authorized work.

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
- Within-scope refinements: pass existing runtime applicability scopes explicitly
  to expansion; deduplicate only scope-variant graph lines; include association
  processing on both canonical-restatement and duplicate-creation return paths.
- Global settings format 4 reads versions 1-3; old-client category omission
  preserves saved association policy. Knowledge schema 4 retains schema-3
  evidence baselines and keeps the earlier L2 conversion for schema 1/2.

## Charter Amendment Log

- none

## Verification

Executed on 2026-09-08 against the final implementation:

- `npm run typecheck` and the core suite's `npm run build`: passed.
- `npm run test:core`: 521 passed, 0 failures/skips, including ten L3 groups.
- `npm run test:membership`: 4 passed; L3 is included in the explicit manifest.
- `npm run test:gui`: 116 passed, 0 failures/skips.

| Acceptance | Executed evidence in association-lifecycle.test.ts |
| --- | --- |
| A25 | Directed canonical endpoints, relation type and canonical scope; reverse/different-type/scope/distractor baselines survive a boost. Runtime claim/entity handles and actual proposal resolution; unresolved/stale targets skip. |
| A26 | Repeated expansion, direct reads and inspection leave complete snapshots unchanged. Graph detail separates baseline/effective values; scope variants keep distinct metadata and share one display line. Legacy links remain untracked. |
| A27 | Exact day 45 active, after day 45 dormant; day 90 decay then boost; backward-clock monotonicity, underflow, cap refresh and small boost remaining dormant. Direct and later alternate routes survive, wrong-scope routes fail, endpoint dormancy is checked independently. |
| A28 | Edge-only proof leaves claim baselines and state unchanged; claim-only proof leaves edge unchanged; both have separate support spans/receipts. Attributed source locator/content dedup survives reimport. Invalid/absent/answer-only support decisions skip. Model numbers/scope do not choose policy. |
| A29 | In-memory and SQLite parity, duplicate edge creation/recurrence and canonical proposal creation, cancellation, atomic claim/edge rollback, injected SQLite receipt failure/retry, concurrent connections, restart and separate project namespaces. |
| P2/P4/P6 | Operation policy snapshot and old-client save preservation. Fixture created by published L2 store d867226; upgrade DDL/version failure rolls back, retry preserves both namespaces and L2 baselines, old writer rejects schema 4, backup restores unchanged evidence and untracked links. Corrupt edge policy and unknown schema fail. |
| A30/B01-B04/L1/L2 | Final necessity/source/docs review and full regression suites: existing one-call adapter, original-source boundary, budgets and projection exclusion retained. No ranking/scaling redesign, recursive propagation, background sweep, dependencies or CSS edits. |

Migration failure is injected at SQLite's version update, and receipt failure at
insert. These tests cover transaction rollback and close/reopen, not physical
power loss. Semantic decisions are synthetic; no live/paid model judgment,
user-database migration, running-application restart, packaged distribution build
or deployment was performed.

Final necessity review: all changed owners serve the five frozen gate rows.
Shared pure evaluation keeps edge/evidence arithmetic consistent without sharing
persistence; explicit runtime applicability scope prevents semantic tags from
standing in for edge applicability. Graph deduplication is limited to displaying
scope variants through the existing edge shape. No charter outcome was added.
The owner's d867226 CSS is unchanged. Frozen body/charter, prior immutable
records, UTF-8, references/fences, credential patterns and diff checks accompany
the archive and handoff review.

## Documentation Updates

- [x] CURRENT_STATUS, SYSTEMDOC, knowledge constitution/process/storage owners.
- [x] JOURNAL, FILESTRUCTURE, collection indexes, archive and handoff.

## Handoff and Follow-ups

- Current state: L3 implemented and verified; ready for authorized integration.
- Next step: integrate the verified handoff; preserve the documented backup before a later user-data upgrade.
- Blockers: none.
- Child tasks: none.
- Resume condition: this charter and frozen target suffice.
- Open questions: none requiring a direction decision.

## Finalize When Complete

- Archive under docs/finished, restore CURRENT_TASK and write a handoff.
- Journal the verified integration on main.
