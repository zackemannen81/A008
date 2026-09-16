# Current Task

Task ID: A008-0119
Parent Task: A008-0103
Status: In Progress
Owner: ChatGPT (operator hotfix)
Created: 2026-09-16
Last updated: 2026-09-16
Charter frozen at: 2026-09-16

## Task Summary

Repair the observed post-output false failure where a normal numbered Markdown answer is classified as chain-of-thought, reduced to an empty final answer, and then reported differently through V1 and V2.

## Task Charter

### Goal

Preserve legitimate final answers through reasoning normalization and make safe runtime validation failures equally diagnosable through V2.

### Primary Deliverable

A narrow reasoning-normalizer regression fix plus safe `RequestError` propagation at the V2 error boundary.

### In Scope

- Remove the generic numbered-bold-Markdown heuristic that treats ordinary answers as chain-of-thought.
- Add regression coverage matching the observed numbered/bold answer shape.
- Preserve safe ACP `RequestError` messages through V2 while keeping unknown runtime/provider errors generic.
- Add focused V2 error-boundary coverage.
### Out of Scope

- Stage 4 identity, receipts, sequencing or reconnect work.
- Changing provider execution, memory semantics, or the V2 success wire.
- Exposing arbitrary internal/provider exceptions to clients.

### Definition of Done

- Ordinary numbered Markdown with bold headings survives `verifiedFinalAnswer` unchanged.
- Existing live NVIDIA reasoning-leak fixture still strips leaked reasoning correctly.
- V2 exposes safe ACP validation messages but masks unknown exceptions as before.
- Focused tests, full typecheck/build and relevant suites pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-01, PC-04 and PC-06.
Contract revision: `1a89d1e`.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Narrow CoT detection | PC-04 reasoning is display-only; final answer drives durable post-output | Legitimate final answers become empty and the completed turn fails during memory intake | Remove the over-broad formatting heuristic; keep explicit leak markers/tags | Normalizer regression + existing live leak fixture |
| Safe V2 runtime detail | PC-01/06 supported clients share runtime behavior and explicit outcomes | V1 shows actionable safe validation text while V2 collapses the same failure to generic `RUNTIME_FAILED` | Pass only ACP `RequestError.message`; keep unknown errors generic | V2 websocket focused tests |

### Minimum Verification Gates

- [ ] Focused reasoning-normalizer tests pass.
- [ ] Focused V2 websocket tests pass.
- [ ] `npm run typecheck` passes.
- [ ] `git diff --check` passes.
