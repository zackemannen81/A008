# Current Task

Task ID: A008-0205
Parent Task: None
Status: Ready
Owner: ChatGPT (operator/implementer)
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
- `docs/adr/0058-bounded-native-tool-context-and-sectional-file-editing.md`

## Task Summary

Harden A008's native `edit_file` after a long real run exposed excessive edit
retry loops. Preserve the existing very small successful-edit response while
making failed edits deterministic, recoverable and non-destructive without
forcing whole-file rereads.

Observed benchmark before this task:
- native A008 successful `edit_file`: 175 model-visible bytes/call in the sampled run;
- DesktopCommander `edit_block`: ~2.0 KiB/call because success returns a preview;
- remote-gateway patch result: 659 bytes/call, plus surrounding state/read jobs;
- the 496-call stress run recorded 53 failed edits out of 202 edit attempts.

Priority order is frozen as:
1. context consumption / avoiding unnecessary rereads;
2. success rate and stability;
3. speed;
4. donor/reference feature parity.

## Task Charter

### Goal

Make native text edits transactional and failure-self-describing while keeping
the successful edit path as compact as it is today.

### Primary Deliverable

A bounded native file-edit engine used by `edit_file` that keeps A008's
workspace/revision contract, performs exact deterministic writes safely, and
returns enough bounded recovery information on failure to avoid blind
read/grep/retry loops.

### In Scope

- Preserve workspace containment, .git refusal, symlink refusal, UTF-8 checks,
  16 MiB processing cap, whole-file SHA guard, approval and compact success receipt.
- Exact-match first; never perform a fuzzy write.
- Harden uniform LF/CRLF/CR handling while keeping mixed endings literal.
- Report exact occurrence count for ambiguous matches.
- On no exact match, return a bounded closest-match diagnostic and compact diff
  when a credible candidate can be found.
- On stale SHA, return current SHA plus a bounded relevant current section so a
  model can rebase without an automatic whole-file reread.
- Serialize edits to the same path within the owning session process.
- Construct and validate a candidate before atomic same-directory adoption;
  preserve the original content if preparation/validation/adoption fails.
- Keep failure diagnostics bounded independently of the global 128 KiB tool cap.
- Regression tests for line endings, ambiguity, stale recovery, fuzzy diagnostic,
  concurrent same-file edits, atomic/adoption failure safety and output bounds.
- Document actual behavior and benchmark implications.

### Out of Scope

- Fuzzy or heuristic writes.
- Multi-file transactions.
- A crash-durable edit journal across OS/process failure.
- Cross-worktree locking; project sessions already own isolated worktrees.
- Replacing A008 native tools with DesktopCommander or remote-gateway MCP.
- General structured-document editing.
- Changes to `exec_command` outcome classification.
- Adding success previews or automatic whole-file verification reads.
- Provider/model changes or semantic-memory changes.

### Definition of Done

- Successful `edit_file` remains a compact receipt containing the new SHA and
  does not include file preview content.
- Exact edits cannot silently apply against a stale whole-file revision or an
  ambiguous/no-match target.
- Failed stale/no-match/ambiguous edits provide bounded actionable recovery data
  in the same tool result and never mutate the target.
- Candidate validation happens before atomic adoption; failed adoption leaves
  the original file intact.
- Same-path native edits are serialized inside the session process.
- Existing repository-tool guarantees and relevant GUI/tool tests pass.
- New tests demonstrate that recovery output remains bounded and successful
  output does not regress materially from the pre-task baseline.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `51a0d76`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Transactional exact edit | PC-LF-06 isolated workspaces; tools operate in the session workspace. Existing ADR 0058 requires bounded native file context. | A failed/partial edit can corrupt session work and force expensive recovery. | Preserve exact edit API; write/validate candidate then atomically adopt under a same-path process lock. | repository-tool transaction/concurrency tests |
| Same-call recovery diagnostics | PC-LF-06 plus ADR 0058 bounded tool context. Owner priority: context consumption before speed. | Generic failures cause repeated read/grep/edit calls and context growth. | Structured bounded stale/ambiguity/closest-match diagnostics only on failure. | failure-output and no-reread-oriented tests |
| Line-ending hardening | PC-LF-06; preserve workspace files exactly except requested edit. | Valid edits can miss or rewrite line endings unexpectedly. | Normalize request text only for a uniform file ending; mixed files remain literal. | LF/CRLF/CR/mixed tests |

### Minimum Verification Gates

- [ ] `npm run typecheck`
- [ ] focused repository/model-tool tests
- [ ] full root test suite if focused checks pass
- [ ] `git diff --check`
- [ ] compare successful and failed model-visible edit result sizes
- [ ] verify no target mutation for stale, no-match, ambiguous and forced adoption failure

### Verification Budget

No live provider calls are required for implementation correctness. A later
owner-triggered stress run may validate model behavior separately.

- Live verification purpose / required provider behavior: not needed
- Budget owner / parent allocation: A008-0205
- Policy revision / inherited or explicit approved limits: current TASK_WORKFLOW; zero live use planned
- max_live_verification_cost (amount + currency): 0 SEK
- max_live_verification_calls (all physical attempts): 0
- max_input_tokens_per_call / max_output_tokens_per_call: not applicable
- live_call_timeout_seconds: not applicable
- Approved provider/model routes / credential-source references: none
- Price reference and checked-at / billing units / currency conversion / allowance: not applicable
- Observed spend / outstanding reservations / unknown cost / attempts / remaining allowance: 0 / 0 / 0 / 0
- Worker allocations or serialized dispatch; resume retains prior usage: single implementation worker

## References

- `src/tools/repository-tools.ts`
- `src/tools/model-tools.ts`
- `test/model-tools.test.ts`
- DesktopCommanderMCP `src/tools/edit.ts` as behavior/recovery reference (MIT); do not copy its implementation.
- remote-gateway `src/file-engine/*` and `src/execution-broker/native-files.ts` as transaction/lock architecture reference; A008 keeps its own contract.

## Checklist

- [x] Benchmark current A008/DC/remote-gateway paths from the same Luna run.
- [x] Freeze context-first success/failure response policy.
- [ ] Implement transactional exact edit engine and same-path lock.
- [ ] Implement bounded structured recovery diagnostics.
- [ ] Add regression and output-size tests.
- [ ] Run verification gates.
- [ ] Update current behavior docs, archive task and write handoff.

## Decisions and Notes

- Success is intentionally asymmetric with failure: success stays minimal; only
  failures pay for recovery context.
- Fuzzy matching is diagnostic only. It must never authorize a write.
- A process-local same-path lock is sufficient for current product authority:
  each durable project session owns an isolated worktree and exactly one active
  session process. Cross-process/global filesystem locking is not introduced.
- The atomicity target is same-directory candidate adoption. This task does not
  claim crash-durable journaling.

## Charter Amendment Log

- none

## Verification

- [ ] Pending implementation.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` if a new source module is added

## Handoff and Follow-ups

- Current state: charter frozen; implementation pending.
- Next recommended step: implement the exact transactional engine before adding diagnostics.
- Blockers: none.
- Child tasks: none.
- Resume condition: immediate.
- Open questions: none inside frozen scope.

## Finalize When Complete

- Archive under `docs/finished/A008-0205_transactional-file-editing.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Write `docs/handoffs/A008-0205.md`.
- Operator appends journal on merge.
