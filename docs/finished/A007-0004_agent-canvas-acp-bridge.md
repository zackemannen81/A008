# Current Task

Task ID: A008-0004
Parent Task: None
Status: Complete
Owner: mrWhite81 and felixnissen
Created: 2026-09-01
Last updated: 2026-09-01
Charter frozen at: 2026-09-01T02:52:50+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0001-product-composition.md`
- `docs/adr/0002-license-and-source-boundaries.md`
- `docs/adr/0003-initial-runtime-and-provider-boundary.md`

## Task Summary

Agent Canvas already supports custom stdio ACP agents through OpenHands Agent
Server. This task establishes that boundary as executable A008 behavior without
forking Canvas or adding a second provider implementation.

## Task Charter

### Goal

Provide a launchable ACP bridge through which Agent Canvas can send a text turn
to the existing A008 chat core.

### Primary Deliverable

An `A008-acp` stdio executable plus a process-level contract test that completes
one streamed text turn through `ChatSession` and the existing NVIDIA adapter
using only a local fake endpoint.

### In Scope

- Decide and document standalone Agent Canvas -> Agent Server -> custom ACP as
  the first GUI boundary.
- Pin and integrate the official stable ACP TypeScript SDK and its required
  runtime peer with license/provenance recorded.
- Add a shared NVIDIA session composition surface used by CLI and ACP.
- Implement ACP initialize, new-session, text-prompt, cancellation, and the
  single verified model selection needed by Agent Server.
- Isolate one `ChatSession` per ACP session and forward answer deltas as ACP
  session updates.
- Add unit and spawned-process contract coverage using fake transport/HTTP
  evidence only.
- Document the exact custom-agent command and environment contract for the next
  Agent Canvas runtime task.

### Out of Scope

- Modifying, vendoring, publishing, or releasing OpenHands Agent Canvas,
  software-agent-sdk, or typescript-client.
- Starting Agent Canvas or claiming a visual GUI/E2E pass.
- Live NVIDIA calls, credential validation, paid usage, or reading `.env.local`
  in automated tests.
- ACP tools, permission requests, file access, MCP, images, session load/resume,
  persistence, authentication flows, runtime model switching, memory, or
  multi-agent runtime behavior.
- Desktop packaging, installer work, automatic fallback, retries, or telemetry.

### Definition of Done

- `A008-acp` speaks stable ACP v1 over newline-delimited JSON on stdio.
- A compiled child process completes initialize -> session/new ->
  session/prompt and emits the expected Agent Canvas-compatible answer update.
- That process reaches the existing NVIDIA adapter against a local fake endpoint
  and never a second provider client.
- CLI behavior and the existing 26 tests remain green.
- The Canvas boundary, limitations, operator command, current status, system
  behavior, file map, decision record, and verification evidence are durable.
- The task is archived and `docs/CURRENT_TASK.md` is restored.

### Minimum Verification Gates

- [x] Clean install from the lockfile, typecheck, build, and all automated tests.
- [x] Spawned ACP protocol test with local fake NVIDIA SSE and no real key.
- [x] Negative tests for missing credential, unknown session, unsupported prompt
  content, invalid model selection, and cancellation rollback.
- [x] CLI help/model/missing-key regression smokes.
- [x] `npm pack --dry-run` confirms the ACP executable and required runtime files.
- [x] Markdown link/fence/index checks, secret scan, raw-legacy staging check,
  and `git diff --check`.
- [x] No live provider, OpenHands build, GUI, packaging, or publication claim.

## References

- Base revision: `ebbc0ea4641df5fff02d66b21f384b45a74e223f`.
- Branch: `codex/A008-0004-agent-canvas-shared-chat`.
- Worker path: `C:\code\A008-workers\A008-0004_agent-canvas-shared-chat`.
- OpenHands Agent Canvas: local clean MIT clone at
  `744e8652f254613045b779eb148bf4f741177975`.
- OpenHands `docs/ACP_AGENTS.md`: custom stdio agents are launched by Agent
  Server and selected through Canvas settings.
- ACP TypeScript SDK v1.4.0: official stable v1 library, Apache-2.0.
- `docs/backlog/first-shared-chat-slice.md`.

## Checklist

- [x] Record the ACP integration decision and dependency provenance.
- [x] Refactor shared NVIDIA session composition without moving environment
  access into core.
- [x] Implement the injectable ACP agent and stdio entrypoint.
- [x] Add unit, protocol, child-process, and regression tests.
- [x] Document Canvas operator configuration and bounded limitations.
- [x] Run every minimum gate and capture exact evidence.
- [x] Update owning documentation, archive the task, and restore the template.

## Decisions and Notes

- Observed: Agent Canvas 1.16 documents a Custom ACP command and sends turns
  through Agent Server; direct browser-to-provider calls are prohibited by its
  repository boundary.
- Supported inference: stdio ACP is the narrowest existing integration path and
  lets A008 retain sole ownership of its provider call.
- Open hypothesis for the next task: the current Windows host can run the full
  Canvas/Agent Server stack; `uv` is not installed and no Canvas dependency
  install or local build has yet run.

## Charter Amendment Log

- none

## Verification

- [x] `npm ci`: five packages installed, six audited, zero vulnerabilities.
- [x] `npm run typecheck` and `npm run build`: exited 0.
- [x] `npm test`: 36/36 passed with zero failed, cancelled, skipped, or todo.
  The official ACP client spawned compiled `A008-acp`, negotiated v1, created a
  session, applied the model option, sent one prompt, reached a loopback fake
  NVIDIA SSE endpoint, and received thought plus answer updates.
- [x] Negative coverage passed for missing credential before transport creation,
  unknown session, image prompt, empty prompt, invalid model, and cancellation
  with ChatSession rollback.
- [x] Direct CLI smokes: help exited 0, model listing exited 0 and named the
  verified model, and missing-key chat exited 2 with the expected message.
- [x] `npm pack --dry-run --json`: exited 0; 51 entries included both CLI and
  `dist/src/acp/server.js` plus the runtime dependency metadata. No archive was
  published.
- [x] All 33 final Markdown files had zero missing relative links, unbalanced
  fences, or collection-index omissions. The 26 staged files had zero known
  NVIDIA/OpenAI/GitHub/private-key patterns and zero raw legacy candidates.
- [x] Direct dependency evidence confirmed ACP SDK 1.4.0 as Apache-2.0, Zod
  4.5.4 as MIT, and the clean external Agent Canvas revision as MIT.
- [x] `git diff --check` passed before archive; final staged diff check is part
  of the completion commit.
- [x] Skipped by scope: OpenHands dependency installation/build, Agent Server,
  browser/GUI, real credential use, live provider, paid usage, desktop package,
  publication, release, tools, persistence, and memory.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs and collection indexes when needed

## Handoff and Follow-ups

- Current state: complete; bridge, tests, decision, runbook, provenance, and
  owning documentation are ready for integration.
- Next recommended step: activate A008-0005 to install/start the pinned Agent
  Canvas and Agent Server runtime, use a loopback fake NVIDIA endpoint, and
  capture a visible browser result through this bridge.
- Blockers: none for the ACP bridge.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: Windows Canvas runtime prerequisites, durable cross-component
  conversation identity, and later memory integration remain for follow-up.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
