# Current Task

Task ID: A008-0078
Parent Task: None
Status: Draft
Owner: Codex (operator)
Created: 2026-09-08
Last updated: 2026-09-08
Charter frozen at:

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
Contract revision: pending commit of the approved contract before Ready.
Constraint: the owner requested this process update; ADR 0034 adopts it.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Own and expose current product requirements | PC-01 through PC-06; existing product ADRs and ADR 0034 | Give the upcoming implementation a concrete authority; without it the gate has no precise referent | A short section in the existing brief, with detailed ADR references | Check every summary against its accepted source and preserve exceptions |
| Require and record necessity | PC-01, PC-02, PC-03; ADR 0034 | Reject invented owners, lexical restrictions and priority policies; scope freeze alone does not establish product need | Workflow rule plus entry/contribution routing and one template section; separate evidence from permission in SYSTEMDOC | Review negative and positive A008 cases and actual diff |
| Preserve verifiable handoff | PC-01 through PC-06; approved docs-first governance in ADR 0001 | The next actor can tell which rule applies and what was checked; stale status and an occupied current-task file would obstruct use | Update existing status/map, archive, template restoration, handoff and operator journal | Links/fences/indexes, immutable-history and source-scope checks, template byte equality |

### Minimum Verification Gates

- [ ] Review at least eight A008-specific positive and negative cases with actual verdicts.
- [ ] Check live references, fences, collection membership and new-file whitespace.
- [ ] Verify product files, existing archives/ADRs and earlier journal entries unchanged.
- [ ] Verify the frozen charter and current-task/template equality at completion.
- [ ] Review staged changes for accidental credential/private-content inclusion and run `git diff --check`.

## References

- Upstream docs-first continuity protocol commit
  `c1b7b44309095d30262d273d8f5d0704629a943c`, Apache-2.0.
- A008 base `440bea9`; local-main identity claim `c1175bc`.

## Checklist

- [x] Read A008 authority and claim A008-0078 on local main.
- [ ] Commit the product contract and decision; pin and freeze this charter.
- [ ] Apply the gate to operating documents and template.
- [ ] Review cases and verify documentation and preservation boundaries.
- [ ] Archive, restore template, hand off and integrate locally with journal.

## Decisions and Notes

- Acting as operator in the canonical repository; no workers are delegated.
- Existing `.grok/` is untracked user material and stays untouched.
- The identity claim is local. Reconcile it with shared main before any later
  push; local allocation does not provide remote collision protection.
- The incoming specific implementation has not been described. This adoption
  supplies its guardrail without reserving an outcome or expanding its scope.

## Charter Amendment Log

- none

## Verification

Pending. This is documentation and semantic self-review, not product runtime
verification or evidence that future actors will follow the rule.

## Documentation Updates

- [ ] Entry, workflow, brief, contribution guide and template
- [ ] ADR 0034 and decision index
- [ ] Status, system document and file map
- [ ] Completed archive, handoff, restored current task and operator journal

## Handoff and Follow-ups

- Current state: Draft with identity claimed locally.
- Next action: commit the approved contract, pin it and freeze this charter.
- Blockers: none for local adoption.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: the owner's next feature remains unspecified and unactivated.

## Finalize When Complete

- Archive the completed charter under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` byte-for-byte from its template.
- Write `docs/handoffs/A008-0078.md`; operator journals on local integration.
