# Current Task

Task ID: A008-0009
Parent Task: None
Status: Complete
Owner: mrWhite81 and felixnissen
Created: 2026-09-01
Last updated: 2026-09-01
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
- `docs/SEMANTIC_MEMORY.md`
- `docs/RUNTIME_IDENTITY.md`
- `docs/adr/0005-semantic-memory-v0-boundary.md`
- `docs/adr/0006-runtime-identity-v0.md`

## Task Summary

Implement the first durable, project-identity-scoped semantic-memory read path.
The path must turn one current message plus bounded recent dialogue into a
validated retrieval plan, merge exact/entity, lexical, tag, domain, and optional
semantic-vector candidate channels, and emit one bounded `MemoryProjection`.
Retrieval remains separate from lifecycle and post-output writes.

## Task Charter

### Goal

Prove that A008 can retrieve task-relevant canonical knowledge from a durable
local store without exposing the full store, treating retrieval as activation,
or coupling the memory core to a provider or UI.

### Primary Deliverable

An exported provider-neutral hybrid memory reader backed by a project-namespaced
SQLite `MemoryRepository`, with a deterministic retrieval planner, unified
candidate scoring, hard thresholds/budgets, and separate debug evidence.

### In Scope

- Record the adopted read-path direction and the SQLite-over-Supabase decision
  in A008-owned documentation and an ADR.
- Add an exact, pinned SQLite dependency compatible with Node.js `>=22.12` and
  record license/provenance.
- Implement a file-backed SQLite repository adapter that preserves the existing
  atomic knowledge+audit contract, validates schema version, survives reopen,
  scopes every operation to one validated A008 `ProjectId`, and accepts an
  explicitly injected path rather than reading environment configuration.
- Maintain a SQLite retrieval index for canonical proposition/kind/tags/scopes
  plus explicitly indexed entities, domains, and optional embeddings.
- Define a deterministic `RetrievalPlanner` contract and baseline planner. It
  may derive intent, weighted domains/tags, entities, terms, temporal hints, and
  at most three semantic queries from the current message and at most two
  bounded recent raw turns; it may not choose knowledge IDs or mutate memory.
- Implement one candidate funnel over exact/entity, lexical, tag, domain, and
  optional vector similarity channels. Deduplicate by canonical knowledge ID,
  score through configurable weights, and keep candidate, projection, and
  persistent activation thresholds semantically distinct.
- Require hard project namespace isolation before all retrieval. Applicability
  scopes remain relevance metadata and never broaden the project namespace.
- Materialize one projection from explicit ranked candidate IDs. Retrieval and
  projection do not reinforce, decay, reactivate, or otherwise mutate canonical
  lifecycle. Dormant current knowledge remains discoverable and observable but
  not projection-visible.
- Emit separate bounded evidence for channel counts, score components,
  inclusion/exclusion reasons, thresholds, dormant discovery, selected IDs,
  and measured projection size. Evidence must not enter serialized execution
  context.
- Add deterministic fixtures and tests for repository durability/rollback,
  namespace isolation, planner bounds, all retrieval channels, channel dedupe,
  threshold separation, dormant behavior, budget enforcement, and corpus-size
  invariance.

### Out of Scope

- Provider-backed classification, query generation, embeddings generation,
  live model calls, credential reads, paid usage, or provider selection.
- Automatic post-output extraction, semantic relation classification,
  reconciliation orchestration, confirmed-use reinforcement, reactivation,
  weakening, decay, archive, or lifecycle tuning.
- ChatSession, CLI chat, ACP, Agent Server, Canvas, or GUI integration.
- Supabase/PostgreSQL/pgvector adapters, Docker changes, deployment, migrations
  against external databases, or writes under `C:\code\supabase-selfhost`.
- Relationship/graph retrieval, exact provider tokenizer coupling, account ACLs,
  synchronization, multi-process topology, production privacy policy, or user
  memory-management UI.
- Importing or copying Kids/AudioLeaf implementation source or its narrative
  defaults. Observed behavior is design evidence only.

### Definition of Done

- A fresh SQLite file initializes schema v1; canonical knowledge and audit
  survive close/reopen; invalid transactions roll back; two project namespaces
  cannot read, retrieve, mutate, or index each other's records.
- The planner is deterministic, bounded, schema-valid, provider-free, and emits
  no selected knowledge IDs.
- One knowledge item returned by multiple channels becomes one scored candidate
  with named components and reasons.
- Retrieval threshold, projection threshold, activation threshold, and hard
  serialized projection budget have separate tests and configuration.
- Dormant current knowledge is found by retrieval but is neither projected nor
  mutated; active selected knowledge crosses the context boundary exactly once.
- Optional vector retrieval works with injected/precomputed equal-dimension
  embeddings. Missing embeddings degrade to the remaining channels without a
  provider call.
- The same query over 100 and 100,000 records with identical relevant canon
  produces byte-identical serialized projection and bounded candidate output.
- Existing memory/chat/CLI/ACP/provider/identity behavior remains green.
- Current truth, durable system docs, file map, dependency inventory, ADR index,
  journal, and immutable task archive describe the implemented boundary.

### Minimum Verification Gates

- [x] Clean `npm ci`, `npm audit --omit=dev`, strict typecheck, build, and full
      fake-only automated test suite pass with zero failures.
- [x] Focused SQLite tests cover reopen durability, schema version, namespace
      isolation, atomic rollback, concurrent serialization, defensive reads,
      retrieval-index synchronization, and temporary-file cleanup.
- [x] Focused read-path tests cover deterministic planning, every implemented
      retrieval channel, dedupe, score evidence, separate thresholds, dormant
      exclusion without mutation, hard budget, and missing-vector degradation.
- [x] A 100-versus-100,000 unrelated-record test produces byte-identical
      projection with bounded candidate count and reports elapsed evidence.
- [x] CLI help/models and missing-credential negative smokes remain provider-free.
- [x] `npm pack --dry-run` contains required runtime files and no local SQLite
      database, credential, raw legacy, dependency tree, or build-only fixture.
- [x] Final Markdown links/fences/indexes, staged secret/raw-legacy/database-file
      scan, dependency license record, template equality, and
      `git diff --cached --check` pass.
- [x] Explicitly record that no live provider, `.env.local`, Supabase service,
      Docker mutation, external database, deployment, publication, or release
      participated.

## References

- Owner direction on 2026-09-01: adopt the proposed bounded hybrid funnel and
  choose SQLite or local self-hosted Supabase for persistence.
- Owner-supplied Context-First Knowledge Architecture, source hash recorded in
  `docs/SEMANTIC_MEMORY.md`.
- Kids narrative-engine behavior was inspected as external design evidence;
  its source, thresholds, decay, and narrative policies are not adopted.
- Node.js 22.12 documents built-in SQLite as experimental and flag-gated; the
  adapter therefore uses an explicit maintained dependency instead.
- `docs/SEMANTIC_MEMORY.md`
- `docs/RUNTIME_IDENTITY.md`

## Checklist

- [x] Adopt the read-path/persistence decision and dependency boundary.
- [x] Implement and test the project-namespaced SQLite repository/index.
- [x] Implement and test retrieval planning and hybrid candidate ranking.
- [x] Implement read-only selected projection and separate evidence.
- [x] Run scale, regression, package, security, and documentation gates.
- [x] Update durable docs, archive A008-0009, and restore the task template.

## Decisions and Notes

- SQLite is selected for the first local adapter because it keeps this proof
  single-process and reproducible. Supabase/PostgreSQL remains a replaceable
  later adapter when multi-process access, RLS, or server vector scale is a
  demonstrated requirement.
- `node:sqlite` is not selected because the declared Node.js 22.12 floor still
  requires its experimental flag. The exact third-party adapter dependency is
  part of this frozen scope.
- Three thresholds are distinct: candidate admission, projection eligibility,
  and persistent activation. Equal numeric values would not merge their meaning.
- The read path may observe dormant canon. Only a later explicit lifecycle task
  may define when confirmed relevance or use reinforces/reactivates it.
- No external attachment path or mutable Kids checkout becomes a stable
  repository citation; the relevant owner direction is restated here.

## Charter Amendment Log

- none

## Verification

- [x] `npm ci` installed eight packages; `npm audit --omit=dev` found zero
      vulnerabilities. Strict typecheck and build passed.
- [x] `npm test` passed 79/79 fake/local-only tests with zero failures, skips,
      cancellations, or todo. The final scale run emitted byte-identical
      projections for 100 and 100,000 records, one candidate, 221 bytes, and
      observed 24 ms/5,443 ms setup-plus-read times.
- [x] CLI help and models exited zero without a credential; chat without
      `NVIDIA_API_KEY` failed before transport creation as intended.
- [x] `npm pack --dry-run --json` reported 111 entries containing the compiled
      memory surfaces and no database, credential, raw legacy, dependency tree,
      or test fixture. The package was not published.
- [x] All 45 pre-archive Markdown files had zero missing relative links,
      unbalanced fences, or indexed-collection omissions. Final archive/template
      and staged-content checks were repeated after task closure.
- [x] `better-sqlite3` 13.0.3 and its installed MIT license match the lockfile
      and dependency inventory.
- [x] No live provider, `.env.local`, Supabase service, Docker mutation,
      external database, deployment, publication, or release participated.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/SEMANTIC_MEMORY.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/THIRD_PARTY.md`
- [x] ADR and ADR index

## Handoff and Follow-ups

- Current state: Complete; identity was claimed and pushed before the Ready
  charter was frozen, and the implementation stayed within that charter.
- Next recommended step: charter the application orchestration boundary that
  supplies complete verified runtime context and composes this projection with
  bounded chat history before the existing provider call.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: Later tasks must choose provider-backed planning/embeddings,
  confirmed-use lifecycle, automatic write orchestration, privacy controls, and
  server-scale persistence independently.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
