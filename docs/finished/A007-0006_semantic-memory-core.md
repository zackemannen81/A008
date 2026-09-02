# A007-0006 — Semantic-memory core

Task ID: A007-0006
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

The shared CLI/Canvas provider path is proven, but a007 has no project-owned
semantic-memory contract or implementation. Establish the first bounded memory
core from the owner's Context-First Knowledge Architecture without coupling it
to a provider, UI, persistence product, or probabilistic classifier.

## Task Charter

### Goal

Define and implement a provider-neutral semantic-memory v0 core that preserves
canonical truth, activation, discovery, context projection, audit separation,
and deterministic state transitions behind an application service and
persistence port.

### Primary Deliverable

An exported TypeScript memory contract plus deterministic in-memory reference
engine with atomic transactions, explicit reconciliation decisions, bounded
materialized context projections, and fake-only automated evidence.

### In Scope

- Adopt a007-owned terminology and invariants from the owner-supplied reference
  document while recording its provenance and non-authority boundary.
- Define orthogonal current/superseded and active/dormant state, materialized
  knowledge, scope, provenance, reconciliation, discovery, projection, budget,
  policy, audit, and persistence-port contracts.
- Implement an in-memory atomic repository and a shared memory application
  service with separate discovery, context, history, and audit surfaces.
- Apply caller-supplied `new`, `restatement`, `extend`, `supersede`, and
  `conflict` decisions with deterministic validation; no semantic decision is
  delegated to a hidden model call.
- Discover current active and dormant canon, reinforce only in-scope knowledge,
  let threshold/keep-alive determine activation, and avoid decay on scope miss.
- Materialize meaning rather than opaque IDs and enforce a hard budget against
  the exact serialized projection through an injected measurement contract.
- Add a no-decay coding-agent reference policy, public exports, architecture
  decision, operator/developer contract documentation, and current-state docs.

### Out of Scope

- Live NVIDIA or other model calls, loading `.env.local`, paid usage, extraction,
  embeddings, vector search, probabilistic relation classification, or retries.
- Durable database/file persistence, migrations, encryption, retention,
  deletion/export, ACLs, synchronization, or production topology.
- Automatic memory ingestion or projection in `ChatSession`, CLI, ACP, Agent
  Server, Agent Canvas, or any GUI; no existing provider-call owner changes.
- Cross-component project/conversation/task/agent identity mapping.
- Full-text search, semantic ranking, decay policies, background processing,
  audit replay, observability dashboards, packaging, deployment, or release.
- Adoption of ACME, loose prototype source, or the owner document itself as an
  implementation baseline.

### Definition of Done

- Public contracts make canonical status and activation status orthogonal and
  keep execution projections structurally separate from audit/provenance data.
- The reference engine atomically handles all five explicit reconciliation
  outcomes without duplicating a dormant restatement or partially committing a
  failed transition.
- Discovery can see current dormant knowledge; only relevant, threshold-
  eligible current knowledge enters a semantically materialized projection.
- The exact serialized projection cannot exceed the supplied hard budget;
  required knowledge causes an explicit failure rather than silent omission.
- The same relevant task produces a bounded projection when 100,000 unrelated
  current items are present, and audit payload size does not alter it.
- All named automated, build, package, documentation, secret, and diff gates
  pass without reading a credential or contacting a model provider.

### Minimum Verification Gates

- [x] `npm ci`, strict typecheck, build, all fake-only tests, and package dry-run
  pass from the lockfile.
- [x] Tests cover new/restatement/extend/supersede/conflict, dormant recovery
  and dedupe, history, threshold activation, keep-alive, scope isolation, and no
  decay on scope miss.
- [x] Tests prove exact serialized-budget enforcement, explicit required-item
  failure, materialized semantics, deterministic ordering, and no audit or
  provenance leakage into the serialized execution projection.
- [x] A 100-versus-100,000 unrelated-item test keeps the same selected semantic
  projection for the same task.
- [x] Invalid references, duplicate IDs, illegal state, policy failure, and
  budget failure leave canonical state unchanged where a transaction applies.
- [x] Public export/import and existing CLI/ACP/core regression tests pass.
- [x] Final Markdown links, fences, collection indexes, staged secret patterns,
  raw-legacy staging, and `git diff --cached --check` pass.

## References

- Owner-supplied `Context-First Knowledge Architecture`, SHA-256
  `770A78D02218F73EA867218CF23B88B8A09997F0EAA1CC5062B045179A7337E2`.
- `docs/backlog/semantic-memory-addon.md`
- `docs/adr/0001-product-composition.md`
- `docs/adr/0003-initial-runtime-and-provider-boundary.md`
- `docs/adr/0004-agent-canvas-acp-boundary.md`
- `docs/adr/0005-semantic-memory-v0-boundary.md`
- `docs/SEMANTIC_MEMORY.md`

## Checklist

- [x] Record the v0 memory boundary and source-derived invariants in owned docs.
- [x] Define exported contracts and typed deterministic errors.
- [x] Implement the atomic in-memory repository and reference service/policy.
- [x] Add invariant, scaling, rollback, regression, and package tests.
- [x] Update durable status, system, structure, backlog, and journal records.
- [x] Run every minimum verification gate and record exact evidence.
- [x] Archive A007-0006 and restore the clean current-task template.

## Decisions and Notes

- The owner document is design input. Its MUST language is not a007 authority
  until adopted by this frozen charter and the task's accepted decision.
- Serialized size is measured over the exact context string by an injected
  measurer. The reference implementation uses exact UTF-8 bytes; a future
  tokenizer adapter can use exact provider/model tokens without changing the
  engine contract.
- Reconciliation classification is explicit caller input in v0. This proves
  state semantics without creating a second or hidden model-call owner.
- ADR 0005 owns the adopted in-process reference topology and separates the
  memory service from chat/provider integration and future durable persistence.

## Charter Amendment Log

- none

## Verification

- [x] Clean `npm ci` installed five packages, audited six, and reported zero
  vulnerabilities; strict typecheck and the standalone build exited 0.
- [x] `npm test` rebuilt the package and passed 54/54 tests with zero failures,
  skips, cancellations, or todo.
- [x] Memory cases cover all five explicit relations, dormant recovery/dedupe,
  threshold activation, supersede chains, scope isolation/no decay, keep-alive,
  required failures, exact budget, materialized semantics, audit/provenance
  exclusion, deterministic ranking, policy-content protection, duplicate IDs,
  invalid state/cycles, rollback, concurrency, and defensive reads.
- [x] The same task produced byte-identical serialized context and measured size
  with 100 and 100,000 current items when added records were unrelated.
- [x] Existing chat, CLI, NVIDIA, SSE, ACP-agent, compiled ACP-process, loopback
  fixture, prompt, model, and shared-composition regressions remained green.
- [x] Package dry-run listed 75 entries including memory JavaScript, maps, and
  declarations; tests/docs remained excluded and nothing was published.
- [x] Memory source contained zero provider, environment, network, filesystem,
  chat, or ACP import/use matches.
- [x] All 39 final Markdown files had zero missing relative links, unbalanced
  fences, or collection-index omissions. Staged candidates had zero known
  NVIDIA/OpenAI/GitHub/private-key patterns and no raw legacy path;
  `git diff --cached --check` passed.
- [x] Not performed: `.env.local` read, credential validation, live model call,
  paid use, semantic extraction/classification, embedding/vector search, durable
  storage, identity mapping, privacy/ACL implementation, chat/ACP/Canvas memory
  integration, deployment, publication, release, or worker-directory deletion.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs and collection indexes when needed

## Handoff and Follow-ups

- Current state: complete; the first a007-owned memory contract and reference
  engine are exported, documented, and fake-only verified.
- Next recommended step: define stable project, conversation, task, agent, and
  ACP-session identity contracts before persistent or automatic integration.
- Blockers: none for v0.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: production persistence/topology, privacy/user control, exact
  model tokens, semantic discovery/classification, post-output analysis, and
  chat/ACP/Canvas orchestration remain deferred.

## Finalize When Complete

- [x] Archive this task under `docs/finished/`.
- [x] Restore the clean current-task template.
- [x] Append a signed `docs/JOURNAL.md` entry.
