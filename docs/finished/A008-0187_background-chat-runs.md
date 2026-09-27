# A008-0187 — Normal GUI background chat runs

Task ID: A008-0187
Parent Task: None
Status: Complete
Owner: Codex, at operator request
Created: 2026-09-26
Last updated: 2026-09-27
Charter frozen at: 2026-09-26

## Goal

Make normal GUI sidebar conversations durable host-owned execution contexts, each
writable conversation bound to one isolated worktree, with concurrent background
runs independent of browser selection and connection lifetime.

## Primary Deliverable

Normal GUI chat submits and observes the existing Platform store/coordinator;
EngineHost supplies existing tools at the conversation's immutable workspace CWD.

## In Scope

- Normal sidebar creation, selection, restore, submission, observation and explicit cancellation.
- Existing GuiWorkspaceStore provisioning and stable conversation/run workspace bindings.
- Minimal durable runtime adapter extension for existing tool execution and permission controls.
- Shared project runtime and semantic memory; browser-local selection.
- Regression tests and owning documentation.

## Out of Scope

- Memory WIP, docs/temp, automatic merge/push/PR/dirty cleanup, distributed workers.
- A second scheduler or new semantic-memory ownership model.
- Automatic legacy conversation migration or replay.

## Definition of Done

- Three normal chats in one Git project receive three distinct durable worktrees.
- Two accepted runs execute concurrently up to configured capacity, with distinct CWDs and one project runtime/memory owner.
- Switching chats/projects, refresh, disconnect and closing the UI never cancel or rebind accepted work; another client observes completion.
- Existing normal-chat repository/MCP tools and permission decisions execute through EngineHost.
- Focused tests, root and GUI typechecks, GUI tests pass; archive and handoff record evidence and limitations.

## Necessity Gate

Contract: docs/PROJECT_BRIEF.md, revision 306a5fadbbdb15fff6f87fab14923a25f60cccdd.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Durable normal chat | PC-LF-01, PC-LF-07; ADR 0053 sections 1–2 | GUI selection cannot own accepted execution; current bridge switch interrupts it | Reuse PlatformStore/coordinator and host HTTP observation | Disconnect, switch and second-client integration regression |
| Per-chat worktree and tools | PC-LF-05, PC-LF-06; ADR 0053 sections 1–3 | Parallel writable chats cannot share mutable checkout or lose tools | Existing GuiWorkspaceStore plus EngineHost session CWD and tool permissions | Three worktrees, concurrent tool CWD proof |
| Shared project runtime | PC-LF-03, PC-LF-04 | Workspace isolation must not split semantic ownership | Existing ProjectRuntimeRegistry keyed by projectId | Same-runtime identity during concurrent runs |

## Minimum Verification Gates

- [x] Focused platform/host/runtime and normal GUI regression tests.
- [x] Root and GUI typechecks, full GUI tests, GUI production build.
- [x] Final diff necessity/scope review and git diff --check.

## Verification Budget

Deterministic local host/provider fixtures; no live-provider verification needed.
Cost 0 SEK; calls 0; input/output token and live timeout ceilings 0.

## Decisions and Notes

- Operator explicitly assigns A008-0187 and authorizes local claim/freeze on the
  requested branch. No commit or push: this overrides the normal main publication
  step. Existing untracked prompt and docs/temp are preserved.
- Existing V1/V2 SDK compatibility and engine panels remain available; normal
  standalone GUI moves to durable execution. Legacy chat history is not silently
  rebound to a new worktree.
- Necessity rechecked against the unchanged PC-LF-01/03/04/05/06/07 clauses and
  ADR 0053. Host snapshots preserve the bound worktree CWD on restore; scoped
  workspace lookup avoids an unrelated unavailable worktree blocking execution.
  Settling existing image-tool work before session release protects tool output
  from being lost when the durable answer is committed. These refine the frozen
  approach without changing semantic ownership or adding a scheduler.
- Normal durable input is text-only. Legacy history migration, attachment input,
  direct image requests and legacy undo/parameter controls are not added to the
  durable routes. Existing compatibility surfaces remain available.

## Checklist

- [x] Inspect authority, current Platform, bridge, sidebar and tool paths.
- [x] Allocate requested identity locally and freeze charter before implementation.
- [x] Implement durable normal GUI and tool runtime integration.
- [x] Verify regressions, update docs, archive and hand off without commit/push.

## Verification

All results below are deterministic local fixtures/local implementation checks
on 2026-09-27. No live provider requests; 0 SEK.

- `npm.cmd run typecheck` and `npm.cmd run build`: pass.
- `npm.cmd --prefix gui run typecheck`: pass; final
  `npm.cmd --prefix gui run build` repeats GUI typechecking and passes.
- `node --test dist/test/platform-host.test.js dist/test/platform-store.test.js
  dist/test/project-runtime-registry.test.js dist/test/local-acp-bridge.test.js
  dist/test/engine-host.test.js dist/test/model-tools.test.js
  dist/test/A008-0142-image-transcript.test.js`: 54/54 pass.
- An earlier sandbox run passed 46/47; Windows `taskkill` could not terminate
  the shell-timeout fixture there. The isolated retry passed 1/1 outside the
  sandbox, followed by the final focused 54/54 run in that environment. No
  terminal implementation change was needed.
- `npm.cmd --prefix gui run test`: 214/214 pass.
- `git diff --check`: pass. GUI build retains the existing dependency annotation
  and bundle-size warnings.
- The real normal-chat client/host regression proves three distinct worktree
  bindings, two active EngineHost tool sessions on one project runtime, distinct
  actual file writes, capacity-two queueing, explicit queued cancellation,
  project/chat switching, tab restore, disconnect and second-client completion.
- GUI regressions prove normal sidebar durable routing, late-response fencing,
  disconnect during discovery/submission, and observation without cancellation
  or implicit replay. Existing tool tests verify repository/MCP permission paths;
  image regression verifies pending generation settles before session release.
- No live-provider or manual browser click-through was performed; the full root
  suite was not requested and was not run. Host crash recovery remains conservative
  and is covered by the existing focused Platform process regression.

## Handoff

Leave changes on codex/A008-0187-background-chat-runs for operator review.
Operator appends JOURNAL on merge.

Archive: `docs/finished/A008-0187_background-chat-runs.md`.
Handoff: `docs/handoffs/A008-0187.md`.
Owning status/system documentation is updated; CURRENT_TASK is restored from
the template. No repository commit or push. `docs/temp` and all A008-0187 prompt
text files are preserved.
