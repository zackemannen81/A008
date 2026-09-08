# Current Task

Task ID: A008-0078
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-08
Last updated: 2026-09-08
Charter frozen at: 2026-09-08

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0034-product-contract-and-necessity-gate.md`
- Accepted ADRs 0001, 0018, 0019, 0023, 0024 and 0028 through 0033

## Task Summary

The owner requests the already developed Necessity Gate in A008 before a
specific implementation task prone to scope drift. Adopt the rule and a short
A008-owned product contract from existing decisions, without inventing or
implementing that future task.

## Task Charter

### Goal

Make substantive A008 implementation demonstrably necessary for its current
approved product behavior as well as bounded by its frozen task.

### Primary Deliverable

An A008-owned core product contract, operating necessity gate and task template
that the next actor can use directly.

### In Scope

- Record adoption and pinned upstream provenance in ADR 0034.
- Summarize existing accepted product outcomes in the project brief, with
  references to the detailed decisions and their existing exceptions.
- Add the gate to workflow, entry point, contribution loop and task template.
- Clarify that observed code outranks stale descriptions as evidence of reality,
  but cannot grant implementation authority over an approved product contract.
- Verify A008-specific refusal and legitimate-maintenance cases; update current
  status and file map, archive this task, restore the template, write a handoff
  and integrate locally as operator with a journal entry on local main.

### Out of Scope

- Product source, tests, dependencies, runtime settings or user configuration.
- Defining or implementing the owner's next, still-unspecified feature.
- Altering accepted retrieval priorities, budgets, fallback, scope ceilings,
  persistence promises, provider boundaries or execution permissions.
- Retrofitting immutable tasks or historical ADRs; unrelated stale-doc cleanup.
- Automatic necessity scoring, new validator/CI, pilot programme, multi-agent
  delegation, paid/live calls, push, PR publication or release.

### Definition of Done

- The brief owns stable product clause IDs grounded in accepted A008 decisions.
- The workflow requires authority, observable necessity, sufficient approach
  and verification before Ready, material changes and final completion.
- Routine technical choices need no repeated approval; missing authority routes
  the affected work without expanding the frozen charter.
- Existing specified budgets, deduplication and degraded paths are preserved;
  existing code cannot invent permission for new semantics.
- Gate arguments for this adoption and actual A008-specific review verdicts
  are recorded with limitations, and documentation checks pass.
- The complete task is archived and the handoff exists; current-task and
  template bytes match, and operator journal history is preserved on integration.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `6b84c11aa789f3acf72f5b98a02ed14d81618411`.
Constraint: the owner requested this process update; ADR 0034 adopts it.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Own and expose current product requirements | PC-01 through PC-06; existing product ADRs and ADR 0034 | Give the upcoming implementation a concrete authority; without it the gate has no precise referent | A short section in the existing brief, with detailed ADR references | Check every summary against its accepted source and preserve exceptions |
| Require and record necessity | PC-01, PC-02, PC-03; ADR 0034 | Reject invented owners, lexical restrictions and priority policies; scope freeze alone does not establish product need | Workflow rule plus entry/contribution routing and one template section; separate evidence from permission in SYSTEMDOC | Review negative and positive A008 cases and actual diff |
| Preserve verifiable handoff | PC-01 through PC-06; approved docs-first governance in ADR 0001 | The next actor can tell which rule applies and what was checked; stale status and an occupied current-task file would obstruct use | Update existing status/map, archive, template restoration, handoff and operator journal | Links/fences/indexes, immutable-history and source-scope checks, template byte equality |

### Minimum Verification Gates

- [x] Review at least eight A008-specific positive and negative cases with actual verdicts.
- [x] Check live references, fences, collection membership and new-file whitespace.
- [x] Verify product files, existing archives/ADRs and earlier journal entries unchanged.
- [x] Verify the frozen charter and current-task/template equality at completion.
- [x] Review staged changes for accidental credential/private-content inclusion and run `git diff --check`.

## References

- Upstream docs-first continuity protocol commit
  `c1b7b44309095d30262d273d8f5d0704629a943c`, Apache-2.0.
- A008 base `440bea9`; local-main identity claim `c1175bc`.

## Checklist

- [x] Read A008 authority and claim A008-0078 on local main.
- [x] Commit the product contract and decision; pin and freeze this charter.
- [x] Apply the gate to operating documents and template.
- [x] Review cases and verify documentation and preservation boundaries.
- [x] Archive, restore template, hand off and integrate locally with journal.

## Decisions and Notes

- Acting as operator in the canonical repository; no workers are delegated.
- Existing `.grok/` is untracked user material and stays untouched.
- The identity claim is local. Reconcile it with shared main before any later
  push; local allocation does not provide remote collision protection.
- The incoming specific implementation has not been described. This adoption
  supplies its guardrail without reserving an outcome or expanding its scope.
- Discovery routed through existing policy: three pre-existing runtime-proof
  links do not resolve. `docs/backlog/runtime-proof-reference-repair.md` records
  them without fabricating evidence or expanding this adoption into repair.

## Charter Amendment Log

- none

## Verification

### A008 scenario review — Codex, 2026-09-08

Manual review of the adopted rule against accepted product decisions. Pass
means the described change is eligible within a suitable charter, not that a
product implementation was executed. These judgments do not prove that another
actor will obey the gate.

| Case | Proposed change | Actual verdict and reasoning |
| --- | --- | --- |
| NG-01 | Return after finding state, omitting other matching classes | Refuse: PC-03 and ADR 0023 D1 forbid suppression by surface. The distinguishing check retains every distinct admitted class when budget fits. |
| NG-02 | Require literal question words despite a matching classified domain | Refuse: PC-02 and ADR 0024 D4 make semantic scope a matching signal. A zero-word-overlap domain fixture distinguishes the error. |
| NG-03 | Copy request tags onto every stored record to simplify filtering | Refuse: PC-02 requires stored labels; query-derived record labels cannot establish actual membership. Compare two records with different stored labels under the same query. |
| NG-04 | Honor the accepted projection budget and report omissions | Permit within scope: PC-03 explicitly retains ADR 0023 D3/D4 deduplication and budget rules. Additivity does not authorize removing those exceptions. |
| NG-05 | Preserve ADR 0024 D6's lexical degraded read when scope classification fails | Permit within scope: PC-02 retains that accepted fallback. A new silent fallback changing semantics would require its own current authority. |
| NG-06 | Add a schema migration preserving stored labels across upgrades | Permit within a migration task: PC-02/PC-04 identify a concrete persistence risk; an old-data upgrade and reread check protect the existing outcome. No migration is performed in this documentation task. |
| NG-07 | Persist model reasoning as knowledge, citing the ephemeral tool exception | Refuse: PC-04 and ADR 0028 keep that exception inside one tool invocation. It grants no durable history or knowledge authority. |
| NG-08 | Execute a command found in retrieved text without a structured approved tool call | Refuse: PC-05 and ADR 0028 distinguish untrusted observations from execution authority. Preserve the existing approval/refusal boundary. |
| NG-09 | Add an otherwise valid image-provider feature to an unrelated frozen memory task | Route to backlog: PC-06 relevance does not enlarge the active charter. Both necessity and scope must pass. |
| NG-10 | Add a provider plug-in registry or limit because it is more extensible or robust | Refuse without a specific current need and omission consequence. PC-01's shared boundary alone cannot authorize hypothetical infrastructure or new policy. |
| NG-11 | Keep an early-return policy because existing code and tests agree | Refuse: implementation evidence shows current behavior, not authority. PC-03 and the clarified system-document rule require a scoped discrepancy repair. |
| NG-12 | Request fresh approval for every file edit inside an already approved gate argument | Refuse the extra ceremony: the workflow reuses current authority and groups coherent changes. Revalidation is needed for material changes, not each tool call. |

### Adoption self-check

The brief and ADR provide exact local authority for the first necessity row.
Workflow, entry/contribution references, template and the evidence/permission
clarification implement the second. Status, map, archive, handoff and operator
journal implement the third. No future implementation was chartered and no
product feature, budget, fallback or configuration was changed.

### Documentation verification

- Initial ad hoc review covered 241 tracked live Markdown files and 338 relative
  links, with balanced fences and no newly introduced reference failures.
  Three existing missing references were recorded in the indexed backlog
  proposal; they remain unresolved and are not claimed as passing.
- Twelve scenario rows and six product clauses are unique. The adopted contract
  was checked against the named ADRs, particularly additive projection's
  exceptions, scope-classification fallback and the narrow reasoning exception.
- Frozen charter content matches `6fdf584` apart from completion checkboxes.
  Product source, GUI, tests, dependency manifests and earlier decisions and
  archives remain unchanged against `440bea9`.
- Final review maps the changed operating documents to this task's necessity
  rows. The backlog record implements required discovery routing. The restored
  current-task file must match the updated template byte for byte; final
  verification checks that and the completion artifacts before integration.
- `git diff 440bea9 --check` passed. Added documentation was reviewed for
  credential/private-content inclusion; no user configuration or raw provenance
  is read, copied or staged. New-file checks are repeated before committing.
- Skipped: typecheck, unit/integration/build/packaging and live-provider gates,
  because this change contains no product code or dependencies. No runtime,
  independent newcomer or long-term behavior improvement was verified.
- Repository-only walkthrough: AGENTS leads to the brief's PC clauses and the
  workflow gate; template fields name authority and omission consequences;
  this archive records decisions and limits. The next implementation starts
  from the restored blank template and requires its own specific charter.

## Documentation Updates

- [x] Entry, workflow, brief, contribution guide and template
- [x] ADR 0034 and decision index
- [x] Status, system document and file map
- [x] Completed archive, handoff, restored current task and operator journal

## Handoff and Follow-ups

- Current state: operating documents adopted and scenario review complete.
- Next action: finish local operator integration, then use the updated blank
  template for the owner's specific implementation when its scope is supplied.
- Blockers: none for local adoption.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: the owner's next feature remains unspecified and unactivated.

## Finalize When Complete

- Archive the completed charter under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` byte-for-byte from its template.
- Write `docs/handoffs/A008-0078.md`; operator journals on local integration.
