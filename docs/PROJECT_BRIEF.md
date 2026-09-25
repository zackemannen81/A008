# Project Brief

Status: Approved product direction
System: A008 Local-First Agent Runtime & Semantic Memory Engine

A008 is a local-first autonomous agent environment for deep software development, semantic memory and parallel project work. The product must remain useful as a standalone local application; hosted infrastructure is an optional extension rather than the foundation of the runtime.

## Core Product Contract

These clauses are the stable product-authority addresses used by the Necessity Gate. Accepted ADRs may refine a clause, but implementation history, old task records and legacy documents do not override this contract.

- **PC-LF-01 — Local-first core.** A008's project/session runtime, local storage, semantic memory, tools, Git integration and operator controls must remain usable without an A008-hosted backend. External model providers may still require network access when selected.
- **PC-LF-02 — Backend is optional capability.** Sync, backup, remote execution, collaboration and hosted access may be added behind explicit interfaces, but must not own the local cognitive/runtime core.
- **PC-LF-03 — A008 owns cognition and semantic memory.** Knowledge, state, retrieval, reinforcement, lifecycle, context construction and semantic authority belong to A008. Execution metadata is not semantic memory.
- **PC-LF-04 — ACME owns execution, not cognition.** ACME may execute model/provider work and report execution evidence; it must not become the authority for A008 memory, truth, retrieval or reasoning policy.
- **PC-LF-05 — Session and workspace are separate concepts.** A conversation/session may exist without a writable workspace. Filesystem isolation is allocated only when work requires it.
- **PC-LF-06 — Parallel writes are isolated.** Writable parallel project sessions use isolated Git worktrees by default; a full clone/copy is a fallback when Git or project tooling makes worktrees unsuitable.
- **PC-LF-07 — Local state remains authoritative.** Optional synchronization replicates explicit state/events between installations; a remote database is not required to become the canonical owner of local A008 state.

## Product direction

The practical rule is the **network-cable test**: removing access to an A008-hosted backend must not stop the local A008 runtime from owning projects, sessions, memory, tools, Git workspaces and local state. A selected cloud model provider may of course require its own network connection.
A008 therefore separates the local product from optional remote services:

```text
A008 Runtime (local-first)
├── projects and sessions
├── semantic memory and current state
├── MCP/tool integration
├── ACME model-execution boundary
├── Git/worktree management
└── local persistence (SQLite)
        │
        └── optional sync/service interface
                 │
                 └── sync, backup, remote access, collaboration
```

The backend is a capability provider, not the cognitive owner of A008.

## Operational modes

### Standalone

A008 can run on one machine with local project state, memory, tools, Git integration and local persistence. No A008 account, central database or hosted control plane is required.

### Standalone + optional sync

A local A008 installation may connect to a sync/service provider for cross-device state, backup, remote access or collaboration. The local runtime remains authoritative for its local work and must degrade cleanly when that service is unavailable.

## Parallel project sessions

A008 distinguishes a **session** from a **workspace**.

- Research/chat sessions may require no writable workspace.
- A writable parallel development session receives an isolated workspace.
- Git worktrees are the default isolation mechanism for Git projects.
- A clone/copy may be used when a project or toolchain cannot safely operate in a worktree.
- Session-specific tools and processes execute with the session workspace as their CWD.
The target topology is intentionally simple:

```text
Project
├── Session A -> shared/read-only project context
├── Session B -> worktree B -> branch a008/session-B
└── Session C -> worktree C -> branch a008/session-C
```

Session completion may expose explicit user-controlled outcomes such as merge, pull request, keep branch or discard workspace. Current implementation status belongs in `CURRENT_STATUS.md` and `SYSTEMDOC.md`, not in this direction document.

## Synchronization direction

A008 does not require a remote database to become the project SSOT. Optional synchronization should transport explicit state/events or other mergeable representations while A008 retains ownership of semantic meaning and conflict/state rules.

Sync may eventually cover project/session metadata, conversation turns, semantic knowledge/state, relationships, task/execution metadata, artifacts and selected settings. The exact transport and storage provider are implementation choices, not product identity.

## Product shape

- **A008 Core** — local/standalone product and runtime.
- **A008 Sync** — optional synchronization/backup capability.
- **A008 Remote / Teams / Cloud** — possible future service layers for remote execution, collaboration or managed infrastructure.

These service layers are optional extensions. They must not turn the local runtime into a thin client that requires a central A008 service to function.

## Why this direction

- Keep the agent/runtime itself as the primary product.
- Avoid forcing account, multitenancy and hosted-database complexity into the core.
- Keep project data and source code close to the user and local filesystem.
- Make parallel development practical without sharing one dirty working tree.
- Allow hosted services to evolve independently behind explicit boundaries.

## Documentation authority

- `PROJECT_BRIEF.md` owns product direction and non-negotiable product boundaries.
- Accepted ADRs under `docs/adr/` refine bounded current decisions.
- `CURRENT_STATUS.md` records where the project is now.
- `SYSTEMDOC.md` records behavior that actually exists.
- Historical material under `_legacy/`, completed tasks and journals is provenance only and cannot override current owners.
