# A008-0224 — Verifiable read-only Git/tool checkpoints and useful failure diagnostics

Status: In Progress
Owner: Rickard; implementation: ChatGPT
Date: 2026-11-21
Branch: fix/a008-0224-safe-readonly-recovery
Base: 0d60455
Authority: docs/PROJECT_BRIEF.md PC-LF-03, PC-LF-05, PC-LF-08

## Observed incident
Fresh Zac McKracken status-report run executed 33 successful tools in 6 durable rounds, without the old repeated planning. At ~2m10s runtime the model reported `Working-state reduction paused: could not commit a verified execution boundary`. The saved run changed to `needs_reconciliation` / effect `unknown` without an answer. Recovery evidence was `verifiable:false`, `revision:null`, `digest:null` from the FIRST checkpoint, even when its only tool was `a008_select_tools`; this proves read-only Git classification alone cannot explain that initial failure. Later checkpoints also contained read-only `git status/log/rev-parse/ls-tree/show/diff`, which the old artifact classifier unconditionally treated as opaque. The new internal `a008_update_workflow` was likewise not on the no-filesystem-effects allowlist. The actual host-side error underlying the rejected boundary was hidden by a generic exception catch.

## In Scope
- Strict read-only Git subcommand + option allowlist for workspace observation; reject mutating Git and unknown flags unchanged.
- Recognize the local, runtime-owned workflow-status tool as non-filesystem modifying (source-validated elsewhere).
- Preserve existing file/HEAD/index/ignored-artifact fingerprinting and fail-closed behavior for opaque tools.
- Persist a fixed non-sensitive `reason` when workspace evidence cannot be verified, distinguishing opaque effects, policy limits, repo mismatch and inspection errors.
- Keep the checkpoint error type/code/message in a bounded diagnostic; never silently suppress it.
- Deterministic regression cases using exact Git invocations from the failed trace; maintain existing negative recovery tests.

## Out of Scope
- Bypassing no-replay or resume authorization; approving old unverifiable checkpoints.
- Changing user base prompt, agent workflow or model provider.
- Modifying the user's Zac repository or replaying any of its actions.
- Treating write commands or unknown MCP tools as recoverable.

## Necessity Gate
| Change | Contract | Observable outcome | Minimum check |
| --- | --- | --- | --- |
| Git read classifier | PC-LF-05/08 | read-only Git should not poison next checkpoint | exact command fixture and mutating-negative test |
| Internal status effect | PC-LF-03/08 | runtime-only checklist update is not an external effect | evidence fingerprint regression |
| Diagnostic reporting | PC-LF-05/08 | do not mask backend rejection and unverifiable cause | explicit reason output and current tests |
| Keep verification strict | PC-LF-05/08 | prevent duplicate external effects after failed restart | opaque-tool + workspace-mutation tests |

## Verification
- [x] TypeScript build and targeted 46/46 tests (read-only Git, checkpoint, recovery, self-contained workflow, membership).
- [x] Adjacent focused ChatSession/working-context tests 20/20.
- [x] GUI host restarted on PID 22236; HTTP GET / = 200; no running/queued jobs at restart.
- [ ] Broad host/session tests: 81/87 passed, 6 failed. The 110-round recovery fixture failed at checkpointed execution steps, and other legacy tests failed on tool-approval/history assumptions or missing expected side-effect files. These failures were not fixed in A008-0224, and require isolated triage of A008-0223 planning/cadence changes versus test fixtures. The broad suite is NOT green.
- [ ] Fresh long provider run confirms verification and continuation.

## Notes
The FIRST checkpoint already had unverifiable evidence before Git. Re-inspecting the same workspace afterwards succeeded: current checkout has 17 files, ~20 KiB, valid HEAD and no submodules. Exact transient failure in that first fingerprint is unknown, so this change records a structured reason for future occurrences. Do not assert that Git was the sole cause of the boundary rejection.
