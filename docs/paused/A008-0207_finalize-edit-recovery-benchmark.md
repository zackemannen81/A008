# Current Task

Task ID: A008-0207
Parent Task: None
Status: Ready
Owner: A008 (GPT-6 Luna worker); Rickard operator
Supersedes: A008-0205
Created: 2026-10-01
Last updated: 2026-10-01
Charter frozen at: 2026-10-01

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0058-bounded-native-tool-context.md`
- `docs/adr/0062-openai-api-calls.md`
- `docs/finished/A008-0205_transactional-file-editing.md`
- `docs/handoffs/A008-0205.md`
- `docs/concepts_sandbox/tools-optimize.md`
## Task Summary

A008-0205 is preserved as a verified predecessor checkpoint rather than completed.
It already adds exact transactional edit planning, bounded recovery diagnostics,
process-local same-path serialization and candidate validation/atomic adoption.

This successor finishes the remaining model-facing edit contract, performs final
integration verification, and records evidence from this A008/Luna task execution
so the operator can compare recovery/context behavior with the predecessor baseline.

Frozen priority:
1. context consumption and avoiding unnecessary rereads;
2. success rate and deterministic safety;
3. speed;
4. donor/reference parity.

## Task Charter

### Goal

Finish native `edit_file` as a compact deterministic recovery surface and produce
inspectable evidence of how Luna actually uses it during a real coding task.

### Primary Deliverable

A green native edit implementation plus
`docs/evidence/A008-0207-tool-recovery-benchmark.md` with measured run data.
### In Scope

- Start from the preserved A008-0205 checkpoint; verify current code before editing.
- Preserve workspace containment, .git/symlink refusal, UTF-8/16 MiB limits,
  whole-file SHA guards, approval flow and compact success receipts.
- Keep exact-match writes only; fuzzy similarity may diagnose but never write.
- Add optional model-facing `expected_replacements` to `edit_file`, default 1.
  Mutation is allowed only when the exact occurrence count equals that value.
- For multi-match success, replace exactly the validated occurrences atomically;
  count mismatch must be non-destructive and return bounded actionable diagnostics.
- Preserve LF/CRLF/CR handling and literal behavior for mixed line endings.
- Preserve same-path in-process serialization and candidate validate/adopt safety.
- Keep stale/no-match/count-mismatch/adoption diagnostics independently bounded.
- Repair additional defects only when a failing in-scope test or current contract
  demonstrates they block this deliverable.
- Run focused and repository verification appropriate to the final diff.
- Analyze this task's own A008 execution trace without adding product telemetry
  solely for the benchmark.
- Record baseline/current metrics and exact source/limitations of each measurement.

### Out of Scope

- Fuzzy/heuristic writes or automatic model retries.
- Multi-file transactions, cross-worktree/global locks or crash-durable edit journals.
- New `search_file`/`find_files` tools or general filesystem discovery redesign.
- Structured `exec_command` outcomes, process sessions, output artifacts or timeout redesign.
- A008-0198 threshold/policy changes or continuation redesign.
- Provider/model fallback, Chat Completions fallback, or disabling Luna reasoning.
- MCP schema/policy changes, semantic-memory changes or GUI redesign.
- Instrumentation whose only purpose is collecting this one benchmark.

### Definition of Done

- Existing A008-0205 transactional/safety regressions remain green.
- `expected_replacements` defaults to 1 and exact N-replacement behavior is tested.
- Count mismatch, stale base, no exact match and adoption failure never mutate target.
- Successful edit output remains compact and supplies the next whole-file SHA.
- Failure output remains bounded and sufficient for a direct corrected retry where
  the host can safely know the relevant current text/count.
- Typecheck/build, focused model-tool tests, `git diff --check`, and the relevant
  root suite pass, or any unrelated pre-existing failure is named with evidence.
- Benchmark evidence records at minimum: total tool calls, edit_file calls,
  failed edit_file calls, read_file calls, and recovery amplification after edit
  failures. Record model-visible edit-result bytes and request bytes when the
  existing trace exposes them; otherwise mark them unavailable rather than infer.
- Final docs describe observed behavior; task is archived and handed off.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `22c0542f518f0bf67dcc0d5a65d531cde029bf24`
| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Exact counted replacements | PC-LF-06; ADR 0058 bounded/revision-guarded native tools | Intentional repeated exact edits otherwise require shell use or extra narrowing/read rounds, increasing context and bypassing the native safety surface | Optional `expected_replacements` with default 1; compare exact count before one atomic candidate/adoption | 1/N/zero/wrong-count, stale and mixed-ending regressions |
| Deterministic bounded recovery | PC-LF-06; ADR 0058; A008-0205 predecessor contract | A failed edit can otherwise trigger blind read/search/edit loops or partial mutation | Reuse the predecessor engine; change only failure projection/safety defects proven by tests | bounded result-size and no-mutation recovery tests |
| Real recovery evidence | PC-LF-03 owns context construction; ADR 0058 explicitly left live retry/token savings unproven | Tool design could be accepted from fixtures while Luna still rereads/retries excessively | Analyze the current A008 run trace and write one evidence report; do not add telemetry just for the report | benchmark report with counts, recovery-amplification method and limitations |
| Preserve native Responses | PC-LF-04; ADR 0062; A008-0206 exact measurement | Changing transport or disabling reasoning would invalidate the operator's intended Luna exercise | Keep the operator-selected Luna route on native Responses; no Chat Completions/reasoning-off workaround | inspect actual route/settings in run evidence; no transport code change |

### Minimum Verification Gates

- [ ] pre-change focused `model-tools` baseline from this branch
- [ ] tests for expected_replacements=1, N, wrong count, stale and non-destructive failure
- [ ] `npm run typecheck --silent`
- [ ] `npm run build --silent`
- [ ] focused repository/model-tool tests
- [ ] relevant root test suite; name unrelated pre-existing failures rather than hiding them
- [ ] `git diff --check`
- [ ] benchmark evidence from the actual A008/Luna task run
- [ ] final diff reviewed against this frozen charter and Necessity Gate

### Verification Budget
The operator-selected A008/Luna worker execution is the task execution and the
benchmark data source. This charter does not authorize the worker to launch an
additional nested live-provider verification campaign from repository code.

- Live verification purpose / required provider behavior: no nested live provider calls required; observe the current worker's native Responses execution.
- Budget owner / parent allocation: A008-0207.
- Policy revision / inherited or explicit approved limits: TASK_WORKFLOW current policy; nested live verification set to zero.
- max_live_verification_cost (amount + currency): 0 SEK for additional/nested verification.
- max_live_verification_calls (all physical attempts): 0 additional/nested calls.
- max_input_tokens_per_call / max_output_tokens_per_call: governed by the operator-started A008 worker runtime, not expanded by this task.
- live_call_timeout_seconds: governed by the existing worker runtime.
- Approved provider/model routes / credential-source references: operator-selected GPT-6 Luna through embedded ACME native OpenAI Responses; existing configured credentials only.
- Price reference and checked-at / billing units / currency conversion / allowance: not applicable to nested verification because none is authorized.
- Observed spend / outstanding reservations / unknown cost / attempts / remaining allowance: record task-run usage only if existing runtime evidence exposes it.
- Worker allocations or serialized dispatch; resume retains prior usage: one A008/Luna worker; no child provider-verification workers.

## References

- `src/tools/file-edit-engine.ts`
- `src/tools/repository-tools.ts`
- `src/tools/model-tools.ts`
- `test/model-tools.test.ts`
- A008-0205 archive/handoff and `docs/concepts_sandbox/tools-optimize.md`
## Checklist

- [ ] Confirm HEAD starts from the pushed A008-0205 checkpoint and capture pre-change focused tests.
- [ ] Inspect the complete edit path/schema; do not assume the predecessor notes are sufficient.
- [ ] Implement optional exact `expected_replacements` with default 1 and bounded count-mismatch recovery.
- [ ] Add/adjust regressions for counted replacement, line endings, stale revisions, concurrency and adoption safety.
- [ ] Run typecheck/build/focused tests, then the relevant root suite and diff check.
- [ ] Inspect this task's actual tool trace and calculate recovery amplification from failed edit operations.
- [ ] Write `docs/evidence/A008-0207-tool-recovery-benchmark.md` with baseline, current measurements, method and unavailable fields.
- [ ] Update CURRENT_STATUS/SYSTEMDOC/FILESTRUCTURE only to observed final behavior.
- [ ] Archive task, write handoff, append journal and restore CURRENT_TASK template before final push.

## Decisions and Notes

- A008 owns the small model contract. Desktop Commander is a recovery-UX reference;
  remote-gateway is a transaction/execution-semantics reference. Do not donor-import
  either tool surface wholesale.
- Success and failure are intentionally asymmetric: success should stay tiny;
  failures may spend a bounded amount of context to prevent another read/search round.
- Baseline carried from A008-0205: the recorded 496-call stress run contained
  202 edit attempts and 53 failed edit attempts; sampled native success output was
  about 175 model-visible bytes. Preserve provenance when comparing unlike counters.
- Recovery amplification for this task means extra model/tool rounds after a failed
  edit until the next successful edit of that target or explicit abandonment.
- Do not claim token/request savings from tool-result bytes alone.
- Native OpenAI Responses is mandatory for the intended Luna run when supported;
  do not use Chat Completions or reasoning-off as a compatibility shortcut.

## Charter Amendment Log

- none
## Verification

- [ ] Review actual changes against the necessity arguments and frozen scope.
- [ ] Record exact commands/results and the final benchmark source.
- [ ] Record skipped/unavailable measurements explicitly.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` if ownership/structure changes
- [ ] `docs/adr/README.md` only if an active-decision index correction is required

## Handoff and Follow-ups

- Current state: Ready; begins from verified A008-0205 checkpoint.
- Next recommended step: run focused pre-change tests, inspect the current edit schema/path, then implement counted exact replacements.
- Blockers: none.
- Child tasks: none.
- Resume condition: immediate in `C:\code\a008-workers\A008-0207`.
- Open questions: broader native search/navigation and structured process-output optimization remain separate follow-up tasks.

## Finalize When Complete

- Archive under `docs/finished/A008-0207_finalize-edit-recovery-benchmark.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Write `docs/handoffs/A008-0207.md`.
- Append a signed journal entry and push the worker branch; do not merge automatically.
