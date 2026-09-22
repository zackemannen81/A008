# Current Task

Task ID: A008-0156
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-22
Last updated: 2026-09-22
Charter frozen at: 2026-09-22, after main allocation 544d23b and necessity review

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant records under `docs/adr/`

## Task Summary

The owner requests completion and improvement of their distributed A008 Platform
specification, motivated by parallel background sessions and multiple projects.
The platform direction is owner-selected; this task authors a reviewable target,
not platform code or implicit acceptance of every proposed technical choice.

## Task Charter

### Goal

Produce a coherent Swedish platform specification grounded in current A008,
with explicit background-run ownership, recovery, migration and acceptance gates.

### Primary Deliverable

`docs/A008_PLATFORM_SPEC.md`, a complete review-ready proposed specification.

### In Scope

- Reconcile the supplied draft with current API, ACME and memory boundaries.
- Specify ownership, concurrency, persistence, identity, devices, synchronization,
  operations, clients, migration, staged delivery and measurable acceptance.
- Identify unresolved decisions with recommendations; index and hand off the draft.

### Out of Scope

- Runtime/source/schema/dependency changes; platform implementation or deployment.
- Replacing accepted ADRs, frozen API semantics or the canonical memory model.
- Push, publication, live-provider calls, merging or new client implementations.

### Definition of Done

- The owner's architectural topics and original background/multiproject need are covered.
- Existing behavior, selected direction, proposed requirements and open decisions are distinct.
- Concurrent writes, disconnection, crash uncertainty and migration have testable outcomes.
- References, Markdown structure, diff scope and documentation indexes are checked.
- Task archive and handoff exist; CURRENT_TASK is restored to its exact template.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: ab52af16b658ed61427b24c2333b2fa9fa51b3b5

One row per coherent change or group serving one outcome. Apply the Necessity
Gate in `docs/TASK_WORKFLOW.md`; results belong in Verification. References,
intended outcomes and planned checks freeze with the charter. Record refinements
of the initial approach in mutable notes within those bounds.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Owner-requested platform design and documentation navigation | PC-01 shared owners, PC-04 durable knowledge/runtime authority, PC-05 explicit execution/credentials, PC-06 supported controls; ADR 0041 current V2, ADR 0043 model-only ACME, ADR 0047 saved chats; CURRENT_MEMORY_MODEL remains normative | Resolve how independent background work can preserve existing authority across projects and clients. Without this review the draft silently contradicts disconnect/tool ownership and can be mistaken for shipped capability | One proposed specification plus index/status pointers; no replacement contract or implementation | Trace all owner topics to sections; compare authority/migration boundaries against source/docs; walk concurrency/crash/isolation scenarios and acceptance matrix |

### Minimum Verification Gates

- [x] Owner-topic coverage and current-versus-target consistency review.
- [x] Concurrency, uncertainty, authorization, memory and migration scenario review.
- [x] Local Markdown links/fences, documentation indexes and `git diff --check`.
- [x] Diff/secret review; archive/handoff prepared for template-restoration closure.

## References

- Baseline: 77060079ff85635b6b4fe888f01038aedbb4c41a.
- `docs/CLIENT_API_V2.md`, `docs/A008_SYSTEM_ARCHITECTURE.md`,
  `docs/CURRENT_MEMORY_MODEL.md`, `docs/adr/0043-acme-execution-boundary.md`
  and current status/system docs.
- Owner's supplied 24-section A008 Platform draft, 2026-09-22.

## Checklist

- [x] Read project authority and inspect current V2/ACME/memory boundaries.
- [x] Claim A008-0156 on main and freeze documentation-only scope.
- [x] Author and review the full specification and decision register.
- [x] Update navigation/status, verify, prepare archive and handoff.

## Decisions and Notes

- Current V2 interrupts active work on detach; durable background runs require an
  explicit compatible/new contract, not a silent rewrite of `/v2/session`.
- ADR 0043 explicitly prohibits ACME tool execution today. The owner's broader
  execution-plane target needs a separately adopted amendment before moving tools.
- No runtime test suite is needed for Markdown-only changes; document validation
  cannot claim any proposed platform acceptance scenario has passed in software.
- The final draft has 28 sections, 12 stable requirement IDs, 24 future acceptance
  scenarios and 12 decision recommendations. A coverage table maps the owner's
  original topics. P1 prioritizes durable background/multiproject work; identity
  scope begins with the local profile rather than retrofitting unscoped storage.
- Manual reconciliation may close orchestration as failed while preserving an
  unknown external effect and target/workspace conflict guard. This prevents an
  indefinite conversation lock without inventing successful cancellation.

## Charter Amendment Log

- none

## Verification

- Necessity/final scope review: one documentation deliverable with status and
  navigation pointers. No runtime, API schema, accepted ADR, product contract,
  memory-semantic or dependency changes.
- Node document validation passes: 28 sequential sections; 12/12 requirement IDs
  covered by 24 unique acceptance scenarios; 12 decision IDs; 13 local Markdown
  links resolve; fenced blocks balance; one JSON example parses; no TODO/TBD.
  Two Mermaid blocks were reviewed as text, not rendered in an automated browser.
- The first coverage checker treated abbreviated PL-01/10 as one ID; corrected
  the checker to expand slash-separated references, then all 12 pass. A15 also
  explicitly verifies user/admin/device permission separation.
- Current/target review against CLIENT_API_V2, SYSTEMDOC, ADR 0043/0047,
  A008_SYSTEM_ARCHITECTURE and CURRENT_MEMORY_MODEL passes. Disconnect, process
  restart, tool-loop ownership and memory-off persistence differences are explicit.
- Scenario walkthrough covers concurrent projects/conversations/workspaces,
  stale workers, unknown effects, cancel races, revocation, deduplication,
  snapshot/event gaps, memory HEAD/reinforcement and migration/restore.
- Primary standards read: RFC 9110 conditional HTTP, RFC 9457 problem details,
  RFC 9700 OAuth security and W3C Trace Context. Short scoped references support
  recommendations, not A008 product authority.
- Diff/secret review and `git diff --check` pass. Examples use synthetic IDs;
  no credentials, private payloads or personal machine paths were introduced.
- Runtime suites, build, live-provider tests and deployment were skipped because
  the change is documentation only. Future platform scenarios remain unexecuted.

## Documentation Updates

- Added `docs/A008_PLATFORM_SPEC.md`; updated CURRENT_STATUS and FILESTRUCTURE.
- Added task archive, handoff and their collection pointers.
- SYSTEMDOC, PROJECT_BRIEF, accepted ADRs and memory target remain unchanged:
  no behavior or detailed platform contract has been adopted by this docs task.
- JOURNAL remains unchanged; operator appends it on merge to main.

## Handoff and Follow-ups

- Current state: review-ready proposed specification, version 0.9.
- Next recommended step: resolve the P0 decisions, then freeze the first bounded
  durable-background-run charter. Do not start the whole platform at once.
- Blockers: none for specification delivery.
- Child tasks: none created.
- Resume condition: a separately scoped implementation request.
- Open questions: D1-D12 in the specification have concrete recommendations and
  stage deadlines; they do not block this documentation-only deliverable.

## Finalize When Complete

- Archive: `docs/finished/A008-0156_platform-specification.md`.
- Restore CURRENT_TASK byte-for-byte from its template before final commit.
- Handoff: `docs/handoffs/A008-0156.md`; no push/merge/publication authorized.
- Operator appends signed JOURNAL entry only on merge.
