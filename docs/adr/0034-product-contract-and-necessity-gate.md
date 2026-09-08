# ADR 0034 — Core product contract and necessity gate

Status: Accepted

Date: 2026-09-08
Task: A008-0078
Decision owner: project owner; implementation by Codex (operator)

## Context and authority

The owner explicitly requested adoption of the Necessity Gate in A008 before
a specific implementation task at risk of scope drift. A frozen task can still
contain an invented product requirement. A008 already owns detailed product
decisions; the missing behavior is a required trace from each substantive
change to those decisions and an observable need.

Source: docs-first continuity protocol, Apache-2.0, commit
`c1b7b44309095d30262d273d8f5d0704629a943c`, workflow and task-template gate.
The upstream implementation is DFC-0002. This record explicitly adopts that
practice with A008-owned product clauses; the ignored bootstrap/reference
copies in A008's root remain non-authoritative.

## Decision

- The Core Product Contract in `docs/PROJECT_BRIEF.md` summarizes current
  approved outcomes as PC-01 through PC-06, tracing details to accepted A008
  ADRs. It adds no runtime behavior, limits, fallback or provider policy.
- The Necessity Gate in `docs/TASK_WORKFLOW.md` requires exact authority,
  observable necessity and omission consequence, smallest sufficient approach,
  and verification. Product necessity and frozen task scope must both permit
  the change. Existing authorization does not need to be requested again.
- Operators review the gate before Ready/delegation; implementers reuse it,
  recheck material changes and review the actual diff before completion.
  Arguments stay in the charter and results in Verification.
- Observed code takes precedence over stale descriptions when establishing
  current reality. It does not outrank approved requirements as permission to
  implement, keep or expand behavior. Conflicts must be recorded and routed.
- Missing authority stops the affected change. Existing routing, operator
  ownership, frozen tasks, empty current-task template on main, and journal on
  operator integration remain intact. No new task state or per-line form.

## Alternatives and consequences

Scope freeze alone leaves product necessity unchecked. A second product file
duplicates the brief's ownership. An automated necessity score measures neither
intent nor semantics, so no checker or runtime policy engine is introduced.

Existing retrieval budgets, deduplication, scope limits and documented degraded
paths remain governed by their accepted decisions. This task neither endorses
new exceptions nor removes existing ones merely because they predate the gate.
The upcoming implementation still needs its own specific frozen charter.

Verification is documentation review and concrete acceptance cases, not a pilot
programme or a claim of improved agent behavior. No live call, external source
publication, remote push or product feature is authorized by this adoption.
