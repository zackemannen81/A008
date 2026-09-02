# Current Task

Task ID: A008-0001
Parent Task: None
Status: Complete
Owner: mrWhite81 and felixnissen
Created: 2026-09-01
Last updated: 2026-09-01
Charter frozen at: 2026-09-01, after claim commit `5768c41` on `main` and the owner's bootstrap request

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`

## Task Summary

Establish the canonical docs-first state for A008 before product implementation.
The repository currently contains a copied protocol surface, a local legacy CLI,
an owner-supplied memory architecture reference, and an OpenHands source clone
that must be inspected before its reuse boundary is described.

## Task Charter

### Goal

Create a truthful, internally consistent continuity surface for A008 so a new
actor can identify the product direction, current evidence, safety boundaries,
multi-agent rules, verification expectations, and next action without chat
history.

### Primary Deliverable

A project-owned `AGENTS.md`, README, ignore policy, and `docs/` continuity
surface for A008, including an archived bootstrap task and a clean active-task
template.

### In Scope

- Replace copied protocol-project facts with A008-owned direction and current
  reality.
- Record the owner-directed composition: legacy NVIDIA CLI capability,
  OpenHands-derived GUI/client capability, and optional add-ons beginning with
  semantic memory based on the Context-First Knowledge Architecture.
- Inspect the local OpenHands clone read-only and record its verified reuse and
  licensing boundaries without copying product code.
- Preserve raw legacy material as local provenance, not current authority or
  committable product source.
- Record and contain the hard-coded credential discovered in legacy material.
- Adopt prefix `A008`; preserve the A008-0001 claim committed on `main`.
- Prepare an advisory multi-agent workflow for at most five writing agents,
  with isolated branches/worktrees and non-overlapping ownership.
- Route implementation, source intake, sanitization, and semantic-memory work
  to bounded backlog proposals.
- Define verification gates for future CLI, GUI, packaging, integration, and
  security work without claiming those gates currently pass.

### Out of Scope

- Implementing or refactoring product code.
- Copying or modifying OpenHands source.
- Installing or claiming the optional multi-agent MCP server is operational.
- Committing raw legacy code, generated legacy output, dependencies, or secrets.
- Implementing the memory engine or selecting its storage/vector adapters.
- Pushing, publishing, deploying, spending paid-service credits, or making live
  NVIDIA calls.
- Claiming conformance to the technical-preview continuity protocol.

### Definition of Done

- Every live authority document describes A008 rather than the protocol source
  repository.
- Current status distinguishes observed facts, owner direction, and open or
  blocked inputs.
- Legacy material is ignored by Git except for a tracked provenance README;
  the exposed credential is documented without reproducing it.
- Architecture, source-reuse, and license decisions are recorded with their
  uncertainty and third-party boundaries.
- The multi-agent workflow states isolation, ownership, locking, and approval
  rules and does not overclaim enforcement.
- Backlog entries make the next bounded work discoverable.
- A008-0001 is verified, archived, and replaced by the clean active template.

### Minimum Verification Gates

- [x] All current-facing relative Markdown links resolve.
- [x] Markdown fences and collection indexes are coherent.
- [x] `git diff --check` is clean.
- [x] `git status` contains no raw legacy or secret-bearing files staged for commit.
- [x] Current status is cross-checked against the working tree.
- [x] No live API call is made; skipped product gates are named with reasons.

## References

- Repository tree and Git history at bootstrap.
- Reviewed bootstrap bundle generated on 2026-09-01.
- Docs-First Continuity Protocol and optional multi-agent add-on, used as
  source references rather than copied project truth.
- Owner-supplied Context-First Knowledge Architecture, summarized into a
  stable backlog proposal rather than treated as executable instruction.
- Local OpenHands clone, inspected as third-party source rather than A008
  authority.

## Checklist

- [x] Inspect repository and legacy evidence read-only.
- [x] Claim A008-0001 on `main`.
- [x] Inspect the OpenHands clone and record its source boundary.
- [x] Rewrite the live continuity surface for A008.
- [x] Add legacy/secret containment and provenance documentation.
- [x] Record architecture, license, multi-agent boundaries, and backlog work.
- [x] Run bootstrap verification.
- [x] Update status and append a signed journal entry.
- [x] Archive this task and restore the active-task template.

## Decisions and Notes

- The owner's direct request freezes the high-level product composition, not
  the detailed framework, storage, or packaging architecture.
- The bootstrap bundle is intake material. Unsupported statements are corrected
  from repository evidence.
- Product source remains absent. Raw legacy input is provenance only.
- The multi-agent limit of five is advisory until a process layer enforces it.
- The credential found in legacy material must be revoked or rotated by its
  owner before any live provider verification.

## Charter Amendment Log

- none

## Verification

- [x] The bootstrap manifest's four SHA-256 entries matched.
- [x] Relative Markdown links, fences, and indexed collection membership passed
  a repository-local PowerShell check.
- [x] The committable file set contained no known NVIDIA/OpenAI key prefix or
  private-key header, and no raw `docs/_legacy/agenten007/` path was staged.
- [x] `git diff --cached --check` passed after the one discovered whitespace
  defect was fixed.
- [x] `node --check docs/_legacy/agenten007/test.js` passed during read-only
  legacy mapping; the client itself was not executed.
- [x] Skipped: product build/unit/integration/packaging because no A008 product
  source exists; OpenHands install/build because intake was read-only; live
  NVIDIA call because credential/cost authority is absent; multi-agent MCP
  installation because it is outside scope.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/JOURNAL.md`
- [x] ADRs, indexes, multi-agent policy, and backlog proposals

## Handoff and Follow-ups

- Current state: Bootstrap complete; no product implementation started.
- Next recommended step: activate the bounded legacy credential remediation and
  first shared-chat slice after owner review.
- Blockers: legacy credential rotation is external; detailed integration and
  new memory-engine contracts remain unchosen.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: OpenHands reuse boundary; GUI integration shape; semantic-
  memory persistence adapter; packaging target.

## Finalize When Complete

- Archive this file under `docs/finished/A008-0001_bootstrap-canonical-state.md`.
- Restore `docs/CURRENT_TASK.md` from the clean template.
- Add a dated, signed journal entry.
