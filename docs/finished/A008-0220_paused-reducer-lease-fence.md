# A008-0220 — preserve reducer pause across lease shutdown

Task ID: A008-0220
Status: Complete (local integration)
Owner: ChatGPT (operator/implementer)
Created: 2026-11-05

## Necessity and bounded scope
- PC-LF-05: durable project sessions; PC-LF-09: checkpointed work must not replay completed effects on recovery. Prior ADR 0064 defines resumable reducer failure.
- Actual Oldschool incident: paused run still contains 52 executed tool calls / 14 rounds, but the final recovery journal epoch was 52 and its current fence epoch became 53. `pauseReduction` clears the lease while `PlatformCoordinator.#finish` still renews it. Renewal failure aborts the signal; the finalizer calls `disableContinuationRecovery`, fencing the paused checkpoint.
- Smallest change: stop lease/timeout timers immediately after successfully persisting a reducer pause, before awaiting `session.stop()`. Keep ordinary cancellation/shutdown fencing unchanged.
- Verification: root build; host invalid-JSON integration with fast renewal and delayed user resume; no live provider calls, zero cost.

## Pre-existing Oldschool checkpoint limitation
The saved Oldschool recovery evidence is `verifiable: false`, including opaque tool invocations. Its current fence epoch is ahead of its saved epoch. Re-enabling or advancing this live checkpoint without reliable evidence would bypass intentional no-replay safety. Do not mutate its fence, replay effects, or claim it is resumable. Preserve for read-only inspection and manual review.

## Out of scope
Changing reducer model behavior, interpreting private model output, rewriting evidence, forcibly resuming unverified work, cleaning Git worktrees, remote publication.

## Verification results
- `npm run build`: PASS.
- `node --test --test-name-pattern='A008-0218 durable reducer invalid-json' dist/test/platform-host.test.js`: PASS 1/1, 18.7 seconds test duration. Test uses 100-ms renew, 30-second lease, 125-ms paused interval, validates unchanged fence and exactly one file creation.
- `node --test dist/test/platform-continuation-recovery.test.js`: PASS 12/12, covering explicit no-replay/effect-fence safeguards.
- An initial extreme 10-ms renew / 1000-ms lease test timed out (not a green verification); the realistic 100-ms / 30-second test above passed. Preserve this limitation.
- Live-provider calls: none. The production Oldschool run was inspected read-only; no real recovery was attempted.
