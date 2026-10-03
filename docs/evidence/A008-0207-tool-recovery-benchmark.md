# A008-0207 tool-recovery benchmark — evidence status

Date: 2026-10-02
Implementation source: merged A008-0207 code at current `main` HEAD `e93c20f`.
Execution trace source: none found in this checkout, worker worktree, repository docs/evidence, or available local tool history. No model-facing A008/Luna tool trace is attached to this execution context.

## Run metrics

| Metric | A008-0207 run | Evidence / limitation |
| --- | --- | --- |
| Total model tool calls | unavailable | No run trace or durable run export available. |
| `edit_file` calls | unavailable | Cannot infer from repository-editing actions or code/test fixtures. |
| Failed `edit_file` calls | unavailable | No model-visible tool outcomes for the task run. |
| `read_file` calls | unavailable | No model-facing run trace. |
| Recovery amplification after failed edits | unavailable | Failed edit → subsequent tool rounds/success-or-abandonment sequence unavailable. |
| Model-visible edit result bytes | unavailable | No actual run results; local fixtures are not model run evidence. |
| Serialized request bytes | unavailable | No attached native Responses request measurements for this run. |

This is an explicit missing-evidence report, not a completed live benchmark. No additional provider call was made: A008-0207 authorizes zero nested live-verification calls. The task-run metrics must remain unavailable rather than be estimated from tool-history records, fixtures, or unrelated runs.

## Comparison baseline carried by the frozen charter

A008-0205 records a 496-call stress run with 202 edit attempts and 53 failed edits (26.2% of edit attempts), plus a sampled successful native edit result of about 175 model-visible bytes. These are predecessor-run figures as reported in the A008-0205/A008-0207 task records; they are not measurements of the A008-0207 execution and are not directly comparable to local test output.

## Implementation and verification observed here

- Current native `edit_file` schema exposes optional `expected_replacements`, defaulting in execution to 1; exact non-overlapping counted edits are performed only after the whole-file revision guard.
- `node --test dist/test/model-tools.test.js`: 30/30 pass. Coverage includes default-single ambiguity, exact N, wrong/zero count, stale revision, bounded failures, compact success receipt, and atomic adoption safety.
- `npm run typecheck --silent`: pass.
- `npm run build --silent`: pass.
- `npm run test:membership`: 4/4 pass.
- `npm --prefix gui run test`: pass (command exit 0).
- `git diff --check`: pass; current worktree has no tracked/untracked changes.
- `npm run test:core`: completed with unrelated failures. Separately reproduced: `platform-admin-cli.test.js` assumes a writable conversation can be created without an isolated Git workspace (HTTP 409); `protocol-contract.test.js` detects generated protocol artifacts diverging from their shared owner after generation. These are outside the native edit path; the full root `npm test` therefore is not green.

## Conclusion

The counted edit contract is implemented and its focused regression suite passes. The mandatory task-run recovery benchmark, including its minimum call and amplification counters, cannot be completed from the currently available evidence. Do not report A008-0207 complete until the operator supplies/exports the native A008/Luna run trace or explicitly routes the missing live measurement through an approved successor task. No GUI changes were made.
