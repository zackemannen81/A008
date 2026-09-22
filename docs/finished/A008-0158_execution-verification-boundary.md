# Current Task

Task ID: A008-0158
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-22
Last updated: 2026-09-22
Charter frozen at: 2026-09-22 after main allocation 04da252 and necessity review

## Read First

AGENTS and its ordered authority docs; CURRENT_MEMORY_MODEL; ADR 0043;
A008_PLATFORM_SPEC v1.0.

## Task Summary

The owner explicitly distinguishes Execution Verification Evidence from semantic
evidence/support/provenance. Update the platform proposal accordingly without
changing cognition, memory semantics or the shipped ACME boundary.

## Task Charter

### Goal

Make execution verification a distinct technical concern throughout the proposal.

### Primary Deliverable

A008_PLATFORM_SPEC v1.1 with explicit definition, ownership, separate data
contracts, unknown outcomes and future acceptance checks.

### In Scope

Terminology, ownership/dataflow constraints and acceptance scenarios in the
existing proposal; documentation status/navigation and task closure.

### Out of Scope

Product source, database/API schema implementation, dependencies, cognition or
memory semantic changes, changes to external repos/accepted ADRs, deployment,
worker launch, live providers, push/publication or merge.

### Definition of Done

- The owner's exact ownership sentence and explicit term appear in section 7.
- Execution observations cannot confer semantic truth/support, HEAD, retrieval,
  task completion, project authority or quality.
- Separate typed schemas/identities and ingestion boundaries are required.
- Unknown/unverified outcomes remain explicit, including opaque adapters.
- Unqualified operational evidence language is replaced or clearly classified.
- Document validation passes; archive, handoff and exact template restoration.

### Necessity Gate

Contract: docs/PROJECT_BRIEF.md, Core Product Contract
Contract revision: ab52af16b658ed61427b24c2333b2fa9fa51b3b5

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Explicit execution-verification terminology/data boundary | PC-01 shared owners, PC-03 additive semantic context, PC-04 runtime-owned knowledge and PC-05 execution; ADR 0043; CURRENT_MEMORY_MODEL | Protect existing cognition/memory semantics from accidental execution-record ingestion or truth promotion caused by overloaded evidence terminology | Clarify existing specification, audit terminology, add boundary acceptance; no behavior/schema change | Search every evidence occurrence; review owners/dataflows and unknown/known failure cases; Markdown/ID/link checks and doc-only diff |

### Minimum Verification Gates

- [x] Owner-requirement coverage and every evidence occurrence reviewed.
- [x] Cognition/memory/ACME boundaries and separate-contract scenarios reviewed.
- [x] Links, fences, JSON, IDs and acceptance coverage checked.
- [x] Scope/secret/diff review; archive/handoff prepared and closure requires exact template restoration.

## References

A008 baseline a4319c1; owner's current terminology clarification;
docs/adr/0043-acme-execution-boundary.md and docs/CURRENT_MEMORY_MODEL.md.

## Checklist

- [x] Read authority, inspect terminology and allocate identity on main.
- [x] Update proposal and documentation pointers.
- [x] Verify and finalize.

## Decisions and Notes

The owner's boundary clarification is authorized. No additional concept proof
or permission request is needed. Existing semantic evidence remains intact.
Operational verification artifacts and quality/review artifacts are distinct.

## Charter Amendment Log

- none

## Verification

Document validation passes: 28 sequential sections, 17 requirements with 17/17
acceptance coverage, 36 unique scenarios, 16 unique decisions, 14 resolving local
links, consistent table columns, balanced fences, one valid JSON example and two
Mermaid blocks. Mermaid reviewed as text, not rendered.

All evidence occurrences reviewed. Section 7.1, PL-17 and A34-A36 explicitly
separate execution observation from semantic ingestion, quality and authority.
Transport failure and unknown effects remain distinct; opaque adapter claims
retain producer boundaries. Normal model-result cognition remains unchanged.

git diff --check passes. Scope and secret review: Markdown only, no runtime,
memory authority, schema, dependency or external-repository modifications.
Runtime tests/build/live-provider calls are not applicable to this change.
Closure checks archive/index links and exact current-task template equality.

## Documentation Updates

Proposal, CURRENT_STATUS, FILESTRUCTURE, archive/handoff and their indexes.
SYSTEMDOC and memory/ADR authority remain unchanged. Journal only on main integration.

## Handoff and Follow-ups

Next implementation should preserve these boundaries in separate contracts.
No runtime changes or publication in this task.
