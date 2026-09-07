# A008-0066 — Runtime preferences verification

Task: A008-0066
Status: Verified locally
Date: 2026-09-07
Boundary: synthetic inputs, isolated settings/SQLite, loopback providers only.

The owner merged the implementation at `06c7d2b` (PR #21). Closure was paused
for the engine task. The remaining browser/documentation gates were completed
against the A008-0067 superset, implementation `649a32d`; this does not pretend
that the earlier paused task already had browser proof.

`test/runtime-preferences.test.ts` verifies atomic/stale settings saves, every
editable field, exact input overflow/repair without history loss, instruction
delivery across reset/model/project/restart and zero projected history, isolation
from semantic system prompts, stable settings during an active operation, actual
retrieval-scope calls and cancellation, semantic output ceilings, staging/intake,
scope/vocabulary/projection budgets and real spawned host/ACP timeout/restart.
The full suite passed: 462 core + 4 repeated membership + 87 GUI executions.
Root typecheck/build and GUI build/typecheck passed. The GUI rerun after a test
type-narrowing fix passed all 87 cases.

Browser proof used the actual extracted A008 runtime/GUI, the companion client's
panel component and process host, and a synthetic provider. At desktop width,
saved reasoning budget 2048 and temperature 0.4; saved a synthetic global identity
instruction. Set input budget to 512, sent a question, observed the actual
`668/512 utf8-bytes` error and retained draft. Raised it to 131072, saved and
submitted the same draft successfully. Closing/reopening the panel preserved
the parameters and instruction. At 390 × 844 the instruction editor, save/reload
controls and close navigation remained usable. No console error was reported.
Local screenshots/logs remain outside the repository under the task evidence
directory; no owner settings or private memory was read or changed.

This proves delivery and control behavior, not live model obedience. No paid
provider call or installed Electron product verification was performed.
