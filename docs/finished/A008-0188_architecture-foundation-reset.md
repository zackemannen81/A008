# Current Task

Task ID: A008-0188
Parent Task: None
Status: Complete
Owner: Codex (operator), direction approved by Rickard
Created: 2026-09-27
Last updated: 2026-09-27
Charter frozen at: 2026-09-27

## Task Summary

Adopt the owner's new architectural foundation in documentation. The owner
explicitly requested archiving all earlier ADRs and updating the project brief,
ADR set, system document and current status after approving durable sessions
with a new session process started by the next message when necessary.

The previous unnumbered CURRENT_TASK contained an implementation summary but
placeholder charter/DoD fields. Its exact contents are preserved in
evidence/A008-0188/previous-CURRENT_TASK.md. It is superseded as active work by
this documentation task, not completed. Its implementation intent must be
rechartered against the new foundation before further runtime work.

## Task Charter

### Goal

Make the approved session/process model the current direction without retaining
old ADR authority or representing unimplemented behavior as shipped.

### Primary Deliverable

One coherent documentation baseline and one new accepted architectural decision.

### In Scope

Archive every previously active ADR; replace ADR indexes; rewrite PROJECT_BRIEF,
SYSTEMDOC and CURRENT_STATUS; preserve exact historical document snapshots;
update navigation and local task records; source-check the runtime ownership gap.

### Out of Scope

Runtime code, database migration, provider calls, process restart, Git commit,
push, deployment, redesign of semantic-memory internals, and automatic adoption
of all old requirements into the new ADR.

### Definition of Done

- Only the new ADR is active; prior records are clearly historical.
- Durable session/workspace identity and on-demand process replacement are explicit.
- Target behavior and source-observed implementation are separated.
- Historical snapshots and moved ADRs retain their original contents.
- Changed current-document links resolve; no old ADR is cited as active authority.
- Task archive and handoff exist; CURRENT_TASK is restored to the template.

### Necessity Gate

Contract revision reviewed: 4368172b78b3a2c6f06e2939625726f7340b5c7e.
Direction amendment: explicit owner instruction of 2026-09-27, recorded by
ADR 0055 and the revised PROJECT_BRIEF in this change. Old PC-LF-05/06 are
explicitly replaced; this is authorized direction work, not runtime implementation.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Reset architecture authority and document ownership | PC-LF-01/03/04/07 retained; PC-LF-05/06 revised and PC-LF-08/09/10 adopted by owner | Agents can distinguish persistent sessions, temporary processes and current direction; old decisions otherwise continue to contradict it | One new ADR, four current document/index owners, exact historical snapshots | Authority/link review and archive hash checks |
| Describe actual ownership and gaps | PC-LF-08/09 with existing local runtime | Prevent process-per-session from being mistaken for shipped behavior | Read existing runtime/store/GUI source and document bounded findings | Source references exist and support each main claim |

### Minimum Verification Gates

- Archive manifest SHA-256 comparison.
- Current-document local-link and active-ADR review.
- git diff --check and documentation-only scope review.
- Preserve pre-existing src/core/model-registry.ts modification unchanged.

### Verification Budget

Not needed. Cost 0 SEK; live calls 0; input/output tokens 0; timeout 0.

## Decisions and Notes

Task identity allocated locally on main before this charter was frozen. No remote
publication is part of the owner's documentation request. Documentation completion
is local and must not be represented as merge/publication.

## Checklist

- [x] Preserve prior documents and allocate task identity.
- [x] Write new baseline and indexes.
- [x] Verify archives, links, source references and diff.
- [x] Archive, hand off and restore CURRENT_TASK.

## Verification

- PASS: nine archive-manifest SHA-256 comparisons preserve previous contents.
- PASS: exactly ADR 0055 active; all 51 historical ADR files indexed.
- PASS: current-document local links/source paths, authority review, git diff --check.
- PASS: pre-existing model-registry.ts modification unchanged by hash.
- PASS: current-task template restored byte-for-byte at completion.
- No runtime tests/builds or live calls: documentation-only work, not runtime acceptance.

## Final necessity review

The final diff implements the authorized documentation reset and source-backed
gap report. Process-per-session and IPC remain future work. No unsupported
runtime claim, source change or automatic old-ADR adoption is included.

## Handoff

See docs/handoffs/A008-0188.md. Complete locally, not committed/pushed/merged.
JOURNAL append belongs to later operator integration under TASK_WORKFLOW.
The original unnumbered task remains historical and is not completed by this work.
