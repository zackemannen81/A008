# Current Task

Task ID: A007-0003
Parent Task: None
Status: Complete
Owner: mrWhite81 and felixnissen
Created: 2026-09-01
Last updated: 2026-09-01
Charter frozen at: 2026-09-01 after claim commit `3e61dd0` and direct owner approval

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

## Task Summary

Create a007's first product code by extracting the useful legacy chat behavior
into a secure provider-neutral TypeScript core, one NVIDIA transport, and a thin
CLI. The owner has revoked the exposed legacy key and placed the replacement in
ignored `.env.local` as `NVIDIA_API_KEY`.

## Task Charter

### Goal

Deliver a buildable and tested chat core that keeps provider I/O, conversation
state, and terminal presentation separate and never embeds credentials.

### Primary Deliverable

A single-package Node.js/TypeScript application with a reusable chat session,
model registry, NVIDIA chat-completions transport, streamed SSE parsing, typed
errors, and CLI commands for model listing and interactive chat.

### In Scope

- Establish a Node.js `>=22.12` TypeScript package with npm lockfile, build,
  typecheck, test, and CLI scripts.
- Define provider-neutral messages, requests, stream deltas, results, transport,
  and session contracts.
- Preserve transactional conversation history: a failed turn does not remain in
  session state.
- Implement one current, officially verified NVIDIA profile:
  `nvidia/nemotron-3.5-lightning-30b-a3b`.
- Implement NVIDIA's OpenAI-compatible `POST /v1/chat/completions` adapter with
  native `fetch`, injected fetch for tests, streaming and non-streaming response
  support, reasoning/content deltas, timeout, and typed error classification.
- Read the credential only from `NVIDIA_API_KEY`; keep `.env.local` ignored and
  add a non-secret `.env.example`.
- Implement a thin interactive CLI over the same public core.
- Test payloads, SSE chunk boundaries, non-streaming responses, errors, timeout,
  history commit/rollback, model registry, and missing credential behavior using
  fake HTTP only.
- Record the initial runtime/provider boundary in an ADR and update durable docs.

### Out of Scope

- Live NVIDIA calls, credential validation against the provider, or paid usage.
- Agent Canvas/OpenHands integration, GUI, Electron, ACP, or Agent Server work.
- Memory-engine, persistence, semantic retrieval, tools/tool execution, images,
  file attachments, or multimodal messages.
- Automatic model fallback, retry loops, provider routing, or multiple provider
  adapters.
- Session persistence, telemetry, packaging/installers, deployment, publication,
  or push.
- Copying the raw legacy script, dependencies, output, media, or credential.

### Definition of Done

- `npm ci`, typecheck, build, and all automated tests pass from repository root.
- The core can be imported independently of CLI and NVIDIA environment setup.
- CLI model listing works without credentials; interactive chat fails clearly
  before any request when `NVIDIA_API_KEY` is missing.
- Fake streaming tests prove reasoning/content assembly across arbitrary byte
  chunks and `[DONE]` termination.
- Fake error tests cover authentication, rate limit, provider/server, timeout,
  network, and invalid response without leaking authorization data.
- Session history commits successful turns and rolls back failed turns.
- No credential value or raw legacy product file is staged.
- Current truth, system behavior, file map, README, ADR/index, backlog status,
  journal, and immutable task archive match the implementation.

### Minimum Verification Gates

- [x] `npm ci`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npm test`
- [x] CLI `models` and `--help` smoke tests without loading `.env.local`
- [x] Negative missing-credential CLI test proves no fetch is attempted
- [x] Secret-pattern and staged raw-legacy scan
- [x] Current-facing Markdown links, fences, collection indexes, and
  `git diff --cached --check`
- [x] Skipped live/provider/GUI/package gates recorded with reasons

## References

- `docs/_legacy/README.md`
- `docs/backlog/legacy-credential-remediation.md`
- `docs/backlog/first-shared-chat-slice.md`
- NVIDIA NIM LLM API reference and current Nemotron 3.5 model page, checked
  2026-09-01

## Checklist

- [x] Claim A007-0003 on `main` and create task branch.
- [x] Verify ignored `.env.local` contains non-empty `NVIDIA_API_KEY` without
  exposing or using its value.
- [x] Freeze and commit this charter before product edits (`b4a430e`).
- [x] Establish package/toolchain and ADR.
- [x] Implement core types, registry, session, NVIDIA transport, SSE, and errors.
- [x] Implement thin CLI and public exports.
- [x] Add fake-only automated tests and run technical gates.
- [x] Update README and durable documentation except final journal/archive.
- [x] Append journal, archive task, restore template, and commit result.

## Decisions and Notes

- Root layout remains a single package for this slice; future GUI work may
  introduce workspaces through a separate task.
- Native `fetch` avoids carrying legacy Axios into the new core.
- The default endpoint is `https://integrate.api.nvidia.com/v1/chat/completions`;
  tests inject a fake fetch and never use it.
- The owner's explicit `.env.local` line is preserved even though `.env.*`
  already ignores the file.
- No fallback behavior is migrated in this task.

## Charter Amendment Log

- none

## Verification

- [x] `npm ci`: installed three development packages from lockfile; audit
  reported zero vulnerabilities.
- [x] `npm run typecheck`: passed with strict and exact optional types.
- [x] `npm run build`: passed; ESM JavaScript, declarations, and source maps
  emitted under ignored `dist/`.
- [x] `npm test`: 26/26 Node test-runner cases passed, zero failed/skipped.
- [x] Direct CLI `--help` and `models` exited 0 without loading `.env.local`.
- [x] Direct CLI `chat` with `NVIDIA_API_KEY` removed exited 2 with a clear
  configuration error; unit coverage proved transport construction count zero.
- [x] All committable candidates had no known NVIDIA/OpenAI key prefix or
  private-key header; `.env.local`, raw legacy, `dist`, and `node_modules` were
  confirmed ignored.
- [x] Final 29-Markdown link/fence/index scan and `git diff --cached --check`
  passed after archive creation.
- [x] Skipped: live NVIDIA call/credential validation and paid usage (not
  authorized); Agent Canvas/GUI/E2E, tools, memory, persistence, packaging,
  installer, deployment, publication, and push (outside frozen scope).

## Documentation Updates

- [x] `README.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/JOURNAL.md`
- [x] ADR/index and affected backlog entries

## Handoff and Follow-ups

- Current state: Complete; secure shared core, NVIDIA adapter, CLI, and fake-only
  verification delivered.
- Next recommended step: activate the Agent Canvas shared-chat integration
  proposal against this public core.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: Agent Canvas boundary, provider ownership in the combined app,
  session identity, and memory remain future tasks.

## Finalize When Complete

- Archive under `docs/finished/A007-0003_secure-chat-core.md`.
- Restore `docs/CURRENT_TASK.md` from the clean template.
- Append a signed journal entry.
