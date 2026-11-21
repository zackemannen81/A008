# A008-0225 — Durable workflow progress receipts and discoverable host restart

Date: 2026-11-21
Owner: Rickard; implementation: ChatGPT
Branch: fix/a008-0225-workflow-receipts-startup
Base: 1924564
Status: Implemented locally; live Luna re-test pending

## Incident
A new Zac McKracken workspace-inspection task performed 20 successful ordinary tool calls and then entered needs_reconciliation with:
`Working-state reduction paused: could not commit a verified execution boundary (Error: Source tool is not retained terminal raw evidence for this run.)`
Sixth source round was not bound; the first five rounds, containing 20 tool IDs, were bound. A008-0223 introduced a runtime-owned `a008_update_workflow` tool but only `a008_select_tools` published a terminal UI tool event through `recordSelection`. The host refuses to bind a source interaction lacking a terminal UI receipt, as intended for replay protection. This explains the failure after the internal status tool instead of after a read.

The first saved workspace fingerprint was independently `workspace-git-root-mismatch`; current repository re-inspection shows identical canonical locations. The equality check has been changed to platform-aware `path.relative(...)=empty` after canonical resolution, keeping the same worktree-root containment policy but avoiding Windows case-only false mismatches. First-run initialisation races cannot be ruled out.

## Changes
- Publish completed `a008_update_workflow` through the existing `recordSelection` host activity channel before checkpoint persistence. Do not synthesize external tool evidence and do not relax `PlatformStore.bindContinuationSourceInteraction` validation.
- Compare canonical worktree root using OS-aware path equality. Other fingerprinting and no-replay constraints remain unchanged.
- Provide `RESTART-A008.cmd` and `restart-a008.ps1` from repo root. Check active/queued jobs; only stop listener on port 8787 if the process is the A008 GUI node command, start from this repo and verify HTTP 200. Log stdout/stderr to C:\log. `-Force` allows deliberate override of active-run guard, but not the process-identity guard.

## Verification
- [x] TypeScript build.
- [x] 42/42 targeted workflow, continuation, checkpoint/recovery and readonly-fingerprint tests.
- [x] Check that internal workflow tool receipt and selection are both emitted in the chronological model-run regression.
- [x] Host-restart script smoke test: initial quoting problem in inline PowerShell->Node invocation was fixed by root-level `check-a008-active.cjs`; restarted prior PID 22236 and received HTTP 200 on new PID 1848.
- [ ] New long live provider run.
- [ ] Full host suite remains known non-green from A008-0224 (81/87); legacy/integration assumptions need independent investigation.

## Safety
Old run remains `needs_reconciliation`, no replay or bypass. No edits to Zac project or saved prompts. Existing A008 Git branch and documented handoff preserved.
