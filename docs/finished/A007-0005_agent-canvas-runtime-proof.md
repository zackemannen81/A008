# Current Task

Task ID: A007-0005
Parent Task: None
Status: Complete
Owner: mrWhite81 and felixnissen
Created: 2026-09-01
Last updated: 2026-09-01
Charter frozen at: 2026-09-01T03:15:54+02:00

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
- `docs/adr/0004-agent-canvas-acp-boundary.md`

## Task Summary

A007-0004 proved the custom ACP bridge at process level. This task proves the
next boundary through a real local OpenHands Agent Canvas and Agent Server: a
browser turn must reach the compiled a007 bridge and return a deterministic
answer from a loopback fake NVIDIA endpoint.

## Task Charter

### Goal

Produce the first visible Agent Canvas chat result through the a007 ACP bridge.

### Primary Deliverable

A reproducible local runtime proof, with a safe evidence record and screenshot,
showing one browser message traversing Agent Canvas -> Agent Server -> compiled
`a007-acp` -> the existing NVIDIA adapter -> a loopback fake endpoint and back.

### In Scope

- Install the pinned OpenHands clone's local npm dependencies and the `uv`/`uvx`
  runtime prerequisite when absent.
- Add a deterministic a007-owned fake NVIDIA chat-completions server for local
  runtime verification only.
- Build a007 and start OpenHands Agent Canvas 1.16.0 plus Agent Server 1.44.1
  with task-isolated state, test-only keys, telemetry disabled, and the task
  worktree as its working directory.
- Configure the active Agent profile through the Canvas UI as Custom ACP with
  the compiled a007 bridge command.
- Send one browser prompt, verify the deterministic reply, verify the user
  message and absence of an error banner, and capture safe visual/runtime
  evidence without credentials.
- Stop only processes started for this proof and leave the external OpenHands
  source checkout clean.
- Update the owning a007 documentation, including the existing file-map defect
  discovered before freeze.

### Out of Scope

- Reading or using `.env.local`, validating the real NVIDIA credential, making
  any external provider request, or incurring paid usage.
- Modifying, committing, publishing, releasing, or merging changes into the
  OpenHands repository or its dependencies.
- Adopting OpenHands source into a007, desktop packaging, installer work,
  deployment, authentication hardening, or production operations.
- ACP tools, permissions, file mutations, MCP, automation service, images,
  durable cross-component resume, multi-agent runtime behavior, or memory.
- Designing or implementing the semantic-memory add-on; that remains a later
  bounded task after this runtime boundary is proven.

### Definition of Done

- A clean install/build of a007 and the pinned OpenHands clone succeeds.
- The browser visibly renders the expected deterministic answer after a prompt
  sent through the configured custom a007 ACP command.
- Runtime evidence shows the loopback fake endpoint received the turn and no
  real provider endpoint or credential was used.
- The OpenHands checkout is clean after the proof and spawned services are
  stopped.
- Evidence, setup/operation instructions, limitations, status, system behavior,
  file map, and journal are durable in a007.
- The task is archived and `docs/CURRENT_TASK.md` is restored.

### Minimum Verification Gates

- [x] A007 clean install, typecheck, build, and all automated tests.
- [x] OpenHands clean npm install, application build, and source-tree check.
- [x] Real Canvas + Agent Server browser round trip through compiled `a007-acp`
  and a loopback fake NVIDIA SSE endpoint.
- [x] UI assertions for the user message, deterministic answer, and no error
  banner, plus a safe screenshot.
- [x] Process/log evidence that only the loopback fake transport was reached.
- [x] Spawned-process cleanup and post-run port/source-tree checks.
- [x] Markdown link/fence/index checks, secret scan, raw-legacy staging check,
  and `git diff --check`.
- [x] Explicit record that `.env.local`, live provider calls, paid usage,
  OpenHands source changes, and memory were not exercised.

## References

- Base revision: `1ac51fc49af97626ceec20db15bc7912c373865e`.
- Branch: `codex/a007-0005-agent-canvas-runtime-proof`.
- Worker path:
  `C:\code\a007-workers\A007-0005_agent-canvas-runtime-proof`.
- A007-0004 bridge task: `docs/finished/A007-0004_agent-canvas-acp-bridge.md`.
- OpenHands Agent Canvas: clean external MIT clone at
  `744e8652f254613045b779eb148bf4f741177975`.
- OpenHands `docs/ACP_AGENTS.md` and its existing Custom ACP mock-LLM browser
  test are implementation references, not a007 authority.

## Checklist

- [x] Add and test the deterministic loopback fake server.
- [x] Install/build both local runtimes without loading real secrets.
- [x] Start the isolated stack and configure Custom ACP through Canvas.
- [x] Execute the browser proof and capture non-secret evidence.
- [x] Stop the stack and verify cleanup plus external checkout cleanliness.
- [x] Update durable documentation and repair the current file map.
- [x] Run every minimum gate, archive the task, and restore the template.

## Decisions and Notes

- Observed: OpenHands already exercises Custom ACP configuration and a browser
  conversation in its own mock-LLM suite; the a007 proof substitutes only the
  compiled a007 ACP process and its loopback fake NVIDIA transport.
- Supported inference: environment inheritance from the isolated Agent Server
  process is the narrowest way to supply test-only `NVIDIA_*` values without
  persisting them in Canvas settings or touching `.env.local`.
- Open hypothesis: the current Windows host can run the pinned Python Agent
  Server through `uvx`; this task tests that premise and records exact evidence.
- Observed: Canvas's shell parser consumed backslashes in the Custom ACP command;
  `C:/...` preserved the absolute Windows path and completed the protocol turn.
- Observed: the successful a007 model request reached only the loopback fixture,
  but external OpenHands code attempted optional OpenAI device-auth/status and
  failed no-credential title generation. Zero external control-plane egress is
  therefore not claimed.

## Charter Amendment Log

- none

## Verification

- [x] `npm ci` installed five a007 packages and reported zero vulnerabilities;
  strict typecheck and build exited 0.
- [x] `npm test` passed 38/38 with zero failures, skips, cancellations, or todo.
  The two added cases verify loopback binding/deterministic SSE and reject an
  incorrect test key.
- [x] `npm pack --dry-run --json` exited 0 with 51 published entries; the test
  fixture/evidence remained outside the runtime package and nothing was
  published.
- [x] OpenHands `npm ci` installed 1,394 packages and reported two moderate plus
  three high audit findings. It also reported a jsdom engine warning on host
  Node 24.14.1. No dependency was changed or auto-fixed.
- [x] OpenHands `npm run build` completed its client and SPA/server phases. The
  external checkout remained clean at
  `744e8652f254613045b779eb148bf4f741177975`.
- [x] Existing portable `uv`/`uvx` 0.11.1 supplied the pinned Agent Server
  1.44.1 environment. `dev:minimal` timed out three times at its fixed 30-second
  gate; the exact locked backend took about 42 seconds and succeeded when run
  separately with the matching Vite frontend.
- [x] Initial browser check found title `OpenHands`, non-empty content, 27
  interactive elements, no framework overlay, zero console errors, and zero
  page errors.
- [x] The browser saved the active Custom ACP profile with a forward-slash
  command, created conversation
  `8fd38dd7-9b82-4f88-8521-8cf54974161a`, displayed the user prompt and
  `A007-CANVAS-LOOPBACK-OK`, and showed no error banner. Stable capture found no
  Running state; Agent Server reported `execution_status: finished`.
- [x] The fake server observed an authorized POST on
  `127.0.0.1:18999/v1/chat/completions`, two messages, the exact prompt, and
  model `nvidia/nemotron-3.5-lightning-30b-a3b`.
- [x] Vite, Agent Server, and fake server were stopped. Ports 3015, 18115,
  18116, and 18999 were free; OpenHands was still clean.
- [x] The safe screenshot was visually inspected. All 35 pre-archive Markdown
  files had zero missing relative links, unbalanced fences, or index omissions;
  15 committable candidates had zero known NVIDIA/OpenAI/GitHub/private-key
  patterns and no raw legacy path; `git diff --check` passed.
- [x] Not performed: `.env.local` read, real credential validation, live model
  inference, paid use, OpenHands source edits/tests, tool/MCP/automation use,
  memory, desktop packaging, deployment, publication, release, or worker/runtime
  directory deletion. Ancillary no-credential OpenAI control-plane behavior is
  disclosed in the evidence record and is not represented as model inference.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs and collection indexes when needed

## Handoff and Follow-ups

- Current state: complete; first visible shared-chat proof and its exact
  limitations are durable.
- Next recommended step: activate a bounded semantic-memory contract task that
  defines identity, event schema, projection budget, persistence port, and
  hermetic egress before memory implementation.
- Blockers: none for the first shared-chat proof.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: maintained Windows launcher behavior, hermetic OpenHands
  control-plane egress, durable cross-component identity, and the memory
  boundary remain for follow-up.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
