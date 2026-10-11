# A008-0213 — Run-local execution-state projection

Task ID: A008-0213
Parent Task: None
Status: Complete locally; awaiting integration
Owner: Rickard / A008
Charter frozen at: 2026-10-05

## Outcome

Implemented a compact, run-local execution-state projection for durable GUI provider requests. The projection presents the accepted objective, runtime phase, observed progress, next action and explicit runtime-owned locked decisions. It remains separate from committed conversation history and semantic memory.

The integration verification exposed and fixed a dropped-state defect: with continuation pressure enabled, `prepareAcpTools` constructed a new tool bundle containing continuation policy but did not copy the already prepared `executionState`. The pressure-enabled durable GUI route therefore omitted execution state despite passing direct ChatSession and non-pressure coverage. The returned tool bundle now retains the trusted execution state as well as the continuation policy.

## Scope and authority

Implemented against the frozen A008-0213 charter and its Necessity Gate clauses PC-LF-03/04, preserving existing continuation/checkpoint ownership, provenance, budgets, workspace authority, effect fencing, approvals and no-replay behavior. Workspace locks come from coordinator-verified workspace identity/mode/path and available branch/base commit. No task ID is inferred because PlatformRun does not own an authoritative charter binding. No new memory, persistence, replay or approval mechanism was added.

## Verification

- `npm run build -- --pretty false` — PASS.
- `npm run typecheck -- --pretty false` — PASS.
- `node --test dist/test/chat-session.test.js dist/test/chat-continuation.test.js dist/test/chat-continuation-pressure.test.js` — PASS (all tests in the three suites).
- Real durable GUI process recovery test — PASS: the existing A008-0199 `continue-110-rounds` platform-host scenario exercised 110 tool rounds and replaced the actual sessions process after round 55. The fixture captured provider requests and verified the exact coordinator workspace locks before and after replacement, recovery-phase context and checkpointed progress, unchanged run/workspace identity, complete tool history, and no tool replay.
- `node --check test/platform-host.test.ts` — PASS.
- `git diff --check` — PASS.
- No live provider calls; 0 SEK.

Full platform-host suite and manual model-backed cognitive-effect observation were not run. Manual observation is operator follow-up, not a completion gate. Local test dependencies were installed from the existing lockfile; no dependency files were changed.

## Files

- `src/tools/acp-tools.ts`
- `test/platform-host.test.ts`
- `docs/CURRENT_TASK.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/handoffs/A008-0213.md`

## Integration note

This is a worktree completion record, not a claim that the behavior has already merged to `main`. Follow the repository integration workflow: inspect/integrate the focused implementation, append the signed journal entry on merge, then activate A008-0214 according to its waiting/supersede charter. Restore `docs/CURRENT_TASK.md` to the empty template before the final commit/push, as the operator’s integration process requires.
