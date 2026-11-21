# A008-0223 — Self-contained execution prompt and chronological task workflow

Status: In Progress
Owner: Rickard (operator); implementation: ChatGPT
Date: 2026-11-21
Branch: fix/a008-0223-self-contained-workflow
Baseline: 915fe49

## Goal
Remove repeated discovery/decision loops caused by loss of prior tool context during long durable A008 sessions. Each new provider invocation must contain the original request and initial retrieved context, an explicit checklist and next action, and a source-backed, chronological account of prior relevant work. Old provider context must not be implicitly required.

## Primary Deliverable
A run-local, durable working document created once at the start of a run, updated through an internal evidence-bound progress tool, preserved by the existing continuation journal, and appended in full to every subsequent provider request. Reduce stale tool history in batches while preserving recent full tool rounds.

## In Scope
- Create a bounded initial description/checklist using the current model and existing user/retrieval context; use a safe, explicit fallback if planning fails.
- Render a complete working document: user request, task description, checklist, chronological completed work with source references, findings, recent raw outcomes, and next action.
- Let the assistant update checked items and next action via an internal tool, accepting completion only when referenced persisted rounds contain successful tool evidence.
- Persist and validate the working document in existing recovery checkpoint; restore without replanning or replaying tools.
- Retain configured recent raw tool rounds and batch compaction rather than reducing on every tool call; compact early on pressure.
- Deterministic regression tests; docs and local-only checkpoint.

## Out of Scope
- Changing the user's base instructions, classification, semantic retrieval, or memory schema.
- Rewriting the reducer's verified-fact representation or existing no-replay/authorization protections.
- Claiming semantic correctness of tasks from file-read success alone. The model chooses milestones; the host verifies existence and reported tool success of cited evidence.
- Provider deployment, paid API integration testing, UI redesign, Git push.

## Necessity Gate
Contract: docs/PROJECT_BRIEF.md at 915fe49.
| Change | Clause | Observable need | Smallest approach | Planned check |
| --- | --- | --- | --- | --- |
| Self-contained work projection | PC-LF-03/04 | 158 repeated reads of 15 unique files and repeated planning after reduction | Runtime-owned workflow injected in every provider request | model request captures, source-ordered chronology |
| Durable workflow state | PC-LF-05/08 | replacement process must not lose task progress or replay effects | Extend existing recovery JSON with bounded optional workflow | save/reopen/resume tests |
| Checkpoint status updates | PC-LF-03/05 | plain "Tool X returned" loses actual action and next step | Internal status tool with evidence ref validation, retain purposes | invalid/success/failure tests |
| Less reduction churn | PC-LF-03/04 | forced 1 raw round caused reduction nearly after every call | respect configured recent window, reduce in batches/at pressure | batch-reduction deterministic test |

## Minimum Verification Gates
- [x] TypeScript build.
- [x] Workflow projection and evidence-gated status regression.
- [x] Durable checkpoint and no-replay resume.
- [x] Existing working-context and reducer regressions.
- [x] ACP/session/process/model tools and native image transport focused regressions (initial one image-order failure corrected and verified).
- [x] Core-suite membership verification.
- [ ] Full core and GUI suite (not run).
- [ ] Live behavior observed by owner on a new task after restart.

## Verification Budget
No external provider calls authorized for this local deterministic implementation: 0 calls, 0 SEK. In-runtime planning call is a product behavior in future runs and uses the user's configured provider.

## Notes
The model is asked for an initial plan once per new run (not every turn). A fallback plan is marked by its generic content; no unverified tool is marked as done. Compacting older rounds does not delete durable source events. For opaque external effects, prior recovery verification still fails closed.

## Current Work
- Initial model plan, stateful checklist, internal update tool, compiled provider projection and recovery integration.
- TypeScript build passed. 48/48 checkpoint/reducer/workflow/membership group; 92/93 initial adjacent group with one first-image-call regression; image-first behavior repaired and 28/28 focused rerun passed. No paid calls. See docs/handoffs/A008-0223.md. Committed locally and GUI host restarted (PID 8904, HTTP 200). Live Luna run remains unverified.
