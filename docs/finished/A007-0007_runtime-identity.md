# A008-0007 — Runtime identity

Task ID: A008-0007
Parent Task: None
Status: Complete
Owner: mrWhite81 and felixnissen
Created: 2026-09-01
Completed: 2026-09-01
Charter frozen at: 2026-09-01

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant records under `docs/adr/`

## Task Summary

Chat, ACP, and semantic memory now have bounded internal contracts, but their
project, conversation, runtime-task, agent, and ACP-session handles are plain
unrelated strings. Establish stable project-owned runtime identity primitives
and an ACP binding port before durable or automatic memory integration.

## Task Charter

### Goal

Define and implement a provider-neutral runtime identity v0 contract that gives
each supported identity kind a canonical opaque value and maps ACP sessions to
stable application context without conflating identity with model-visible
semantics.

### Primary Deliverable

Exported typed runtime IDs, strict parser/factory, external-reference contract,
and atomic in-memory ACP identity-binding repository, with the A008 ACP bridge
using canonical ACP-session IDs by default.

### In Scope

- Define distinct `project`, `conversation`, runtime `task`, `agent`, and
  `acp_session` ID kinds with a versionable A008 prefix and canonical lowercase
  UUID-v4 payload.
- Provide branded TypeScript types plus runtime create, parse, kind-inspection,
  and validation behavior; reject cross-kind use and non-canonical values.
- Explicitly distinguish product runtime task IDs from docs-first identities
  such as `A008-0007`.
- Define bounded external identity references and an `AcpIdentityBinding` that
  links all five A008 IDs without assigning semantic meaning to the handles.
- Define an identity-binding repository port and atomic, concurrency-serialized
  in-memory reference adapter with idempotent registration, uniqueness,
  conversation consistency, external-reference resolution, and defensive reads.
- Make default `A008-acp` session creation use the canonical `acp_session` ID
  contract and reject malformed or duplicate injected IDs without overwriting
  an existing session.
- Add public exports, an A008-owned decision and identity contract document,
  update current-state docs, and repair the stale SYSTEMDOC source-boundary
  phrase that says no memory engine exists.

### Out of Scope

- Durable identity or binding persistence, migrations, distributed allocation,
  deletion, merging, aliases, legacy-ID import, account/login identity, ACLs,
  encryption, retention, telemetry, or PII storage policy implementation.
- Obtaining or modifying Agent Server/Canvas conversation IDs; the current ACP
  new-session request does not provide that external conversation handle.
- ACP load/resume, conversation persistence, task lifecycle, agent switching,
  memory/chat/CLI/GUI integration, automatic ingestion, or prompt changes.
- Changing provider-call ownership, making model/provider/network calls, reading
  `.env.local`, live inference, paid usage, packaging, deployment, or release.
- Treating an opaque ID as knowledge or including binding/external-reference
  control data in model context.

### Definition of Done

- All five identity kinds round-trip through one canonical format and cannot be
  parsed as another kind; generated values contain no user or task semantics.
- Binding registration is atomic and idempotent for an identical record, while
  ACP-session, external-reference, or conversation-context conflicts fail
  without mutating prior state.
- One conversation can have multiple ACP bindings only when project and agent
  context remain consistent; runtime task IDs may differ between bindings.
- Lookups by ACP session, external reference, and conversation return defensive
  records and never expose a general mutable registry map.
- Direct and compiled ACP tests prove canonical default session IDs, injected
  deterministic IDs, malformed-ID rejection, and duplicate protection while all
  existing chat/provider/memory behavior remains green.
- All build, package, documentation, staged-secret, raw-legacy, and diff gates
  pass without a credential or external runtime.

### Minimum Verification Gates

- [x] `npm ci`, strict typecheck, build, all fake-only tests, and package dry-run
  pass from the lockfile.
- [x] ID tests cover creation/parsing for every kind, strict canonical format,
  wrong-kind/malformed rejection, UUID-factory validation, and opaque output.
- [x] Binding tests cover create/idempotency, multiple consistent sessions,
  inconsistent conversation context, duplicate ACP/external handles, lookup
  resolution, concurrency serialization, rollback, and defensive copies.
- [x] ACP unit and compiled-process tests cover canonical defaults plus malformed
  and duplicate injected session IDs; existing protocol behavior regresses green.
- [x] Public export/import and all existing chat, provider, ACP, loopback, and
  100-versus-100,000 semantic-memory tests pass.
- [x] Identity source has no provider, environment, filesystem, or network
  dependency; no identity/binding record enters a model request in this slice.
- [x] Final Markdown links, fences, collection indexes, staged secret patterns,
  raw-legacy staging, and `git diff --cached --check` pass.

## References

- `docs/PROJECT_BRIEF.md` open decision 5.
- `docs/adr/0004-agent-canvas-acp-boundary.md`
- `docs/adr/0005-semantic-memory-v0-boundary.md`
- `docs/adr/0006-runtime-identity-v0.md`
- `docs/SEMANTIC_MEMORY.md`
- `docs/RUNTIME_IDENTITY.md`
- `src/acp/A008-acp-agent.ts`

## Checklist

- [x] Record the runtime-ID and ACP-binding decision in owned docs.
- [x] Implement and export typed canonical identity primitives and errors.
- [x] Implement the binding port and atomic in-memory reference repository.
- [x] Adopt canonical default IDs at the existing ACP session boundary.
- [x] Add identity, binding, ACP, regression, and package tests.
- [x] Update durable status, system, structure, backlog, and journal records.
- [x] Run every minimum verification gate and record exact evidence.
- [x] Archive A008-0007 and restore the clean current-task template.

## Decisions and Notes

- `A008-NNNN` remains a repository-governance task address. Runtime task IDs use
  the new product identity format and do not imply docs-first authority/status.
- External references are namespaced opaque control-plane values. They can be
  resolved by runtime but are not semantic context for a model.
- V0 binds one ACP session to one complete context. Multiple sessions may share
  a conversation only with the same project and agent; task may differ.
- The repository port allows later durable storage without claiming that the
  in-memory adapter survives process restart.
- ADR 0006 records the canonical format, cardinality, external-reference, and
  honest current-ACP intake boundaries.

## Charter Amendment Log

- none

## Verification

- [x] Clean `npm ci` installed five packages, audited six, and reported zero
  vulnerabilities; strict typecheck and standalone build exited 0.
- [x] `npm test` rebuilt the package and passed 66/66 tests with zero failures,
  skips, cancellations, or todo.
- [x] All five kinds round-trip through canonical v1 parsing. Wrong-kind,
  malformed, uppercase, docs-task, invalid UUID source, and unknown kind inputs
  are rejected; 100 default conversation IDs were unique and semantic-free.
- [x] Binding cases cover normalized idempotency, multiple task/session records,
  stable conversation project+agent, all conflict classes, concurrent external
  claims with one atomic winner, lookups, rollback, and defensive copies.
- [x] Direct ACP cases prove canonical default, valid deterministic injection,
  malformed rejection, and duplicate protection. The compiled official ACP
  client received a canonical session ID and completed the loopback turn.
- [x] Existing chat, CLI, NVIDIA, SSE, memory including 100-versus-100,000,
  prompt, model, loopback, and shared-composition tests remained green.
- [x] Package dry-run listed 91 entries including identity JavaScript, maps, and
  declarations; tests/docs remained excluded and nothing was published.
- [x] Identity source contained zero provider, environment, filesystem, network,
  chat, or memory import/use matches.
- [x] All 42 final Markdown files had zero missing relative links, unbalanced
  fences, or collection-index omissions. Staged candidates had zero known
  NVIDIA/OpenAI/GitHub/private-key patterns and no raw legacy path;
  `git diff --cached --check` passed.
- [x] Not performed: `.env.local` read, credential validation, live model call,
  paid use, Agent Server/Canvas run or source edit, complete runtime binding,
  durable storage, migration, account/ACL/privacy implementation, load/resume,
  memory/chat/CLI/GUI binding, deployment, publication, release, or worker-path
  deletion.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs and collection indexes when needed

## Handoff and Follow-ups

- Current state: complete; five runtime ID kinds, binding port/reference, and
  canonical ACP-session generation are exported and verified.
- Next recommended step: define a bounded application orchestration contract
  that receives complete verified identity context before memory projection or
  post-output analysis.
- Blockers: none for identity v0.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: external conversation intake, durable persistence, privacy,
  identity lifecycle/migrations, memory orchestration, and ACP load/resume.

## Finalize When Complete

- [x] Archive this task under `docs/finished/`.
- [x] Restore the clean current-task template.
- [x] Append a signed `docs/JOURNAL.md` entry.
