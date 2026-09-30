# File Structure

This is the current high-level repository map. It intentionally omits generated output, dependencies, screenshots, and the internal contents of historical provenance trees. Detailed behavior belongs in `SYSTEMDOC.md`; product direction belongs in `PROJECT_BRIEF.md`.

## Repository root

```text
A008/
├── AGENTS.md                 repository working rules and authority order
├── README.md                 public project entry point
├── src/                      A008 runtime and application implementation
├── gui/                      A008-owned web GUI
├── packages/                 independently consumable protocol/client packages
├── scripts/                  build, verification, benchmark and packaging scripts
├── test/                     root runtime/integration/contract tests
├── docs/                     current project documentation and historical records
├── public/                   public GUI/static assets
└── package.json              root build/test/runtime commands
```

## Runtime source

`src/` is organized by responsibility rather than by historical task:
- `acp/` — ACP compatibility/server surfaces.
- `bootstrap/` — project bootstrap and registry helpers.
- `core/` — core chat/invocation contracts.
- `core/mcp-tool-policy.ts` — explicit server/tool strictness carried in ACP metadata; catalog and model tools retain policy ownership.
- `engine/` — portable/shared engine host.
- `gui-host/` — local GUI HTTP/WebSocket host and project/session routes.
- `identity/` — application/runtime identity primitives.
- `ingest/` — source/document ingestion.
- `memory/` — A008-owned semantic memory, persistence, retrieval and knowledge state.
- `orchestration/` — application orchestration and semantic model coordination.
- `platform/` — durable store/coordinator and session process manager used by normal GUI chat and public V3.
- `platform/session-process.ts`, `session-worker.ts`, `session-ipc.ts` — host ownership, OS child and private instance/run-bound IPC.
- `platform/gui-run-session.ts` — EngineHost/tool adapter running inside the session child.
- `platform/continuation-workspace.ts` — bounded Git/file evidence for checkpoint recovery; persistence and effect fences remain in PlatformStore, dispatch in the coordinator.
- `memory/knowledge/workspace-observation.ts` — qualifies session observations and structured addresses by workspace.
- `prompt-contracts/` — maintained prompt contracts.
- `providers/` — provider/model adapters and catalogs.
- `runtime/` — project runtime, workspace/session ownership and local composition.
- `tools/` — model/tool execution surfaces.
- `tools/repository-tools.ts` — paginated native file reads with whole-file revisions,
  guarded edits and bounded Git output; `model-tools.ts` owns native/MCP registration,
  approvals and per-call output ceilings.

## GUI

`gui/src/` contains the product GUI. Major current surfaces include:
- `chat/`, `composer/`, `session/` — conversation/session UX.
- `session/durable-chat-client.ts` and `use-durable-chat.ts` — normal GUI selection and durable-run observation; engine panels retain the existing V1 adapter.
- `session/durable-observation.test.ts`, `chat/durable-live-transcript.test.ts` —
  authoritative durable messages, optimistic submission and stale observation regressions.
- `projects/` — project tree, saved chats and parallel workspace controls.
- `memory/` — memory inspection and relationship map.
- `settings/` — runtime/provider/appearance settings.
- `tools/`, `terminal/`, `files/`, `workbench/` — operator/developer surfaces.
- `platform/` — optional platform UI.
- `browser/`, `images/`, `upload/`, `artifact/` — supporting product surfaces.

## Packages

```text
packages/
├── protocol/                 shared schemas, parsers, routes and generated OpenAPI/JSON Schema
└── client/                   typed A008 client adapters for supported protocol surfaces
```
## Documentation

The docs root is deliberately small. New topic-specific authority documents should not be added when one of the current owners below can hold the information.

```text
docs/
├── PROJECT_BRIEF.md          approved product direction and Core Product Contract
├── CURRENT_STATUS.md         current observed state and gaps against the approved architecture
├── SYSTEMDOC.md              durable behavior that actually exists
├── CURRENT_MEMORY_MODEL.md   current semantic memory/context model
├── CURRENT_TASK.md           active branch task; empty template on main
├── TASK_WORKFLOW.md          task lifecycle, necessity gate and completion rules
├── CONTRIBUTING.md           contributor workflow
├── MULTIAGENT.md             multi-agent working rules
├── FILESTRUCTURE.md          this repository map
├── JOURNAL.md                append-only dated integration history
├── TASK_IDS.md               task identity allocation
├── adr/                      active ADRs 0055–0060 (sessions, context, recovery, tools, GUI observation, MCP strictness); pre-0055 records are _legacy history
├── backlog/                  current deferred work plus _legacy retired backlog
├── tasks/                    durable task/program records
├── finished/                 immutable completed task records
├── handoffs/                 task handoffs
├── paused/                   paused task records
├── evidence/                 verification evidence; A008-0188 preserves pre-reset document snapshots
├── platform/                 implementation-local docs for existing optional platform components
├── prompts/                  maintained prompt documentation
├── concepts_sandbox/         non-authoritative concepts and design exploration
└── _legacy/                  historical provenance; never current authority
```

### Documentation ownership rule

Prefer updating `PROJECT_BRIEF.md`, `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `CURRENT_MEMORY_MODEL.md`, or this map over creating a new root-level topic document. Accepted ADRs record bounded durable decisions. Historical records remain available under task/history/legacy collections but do not override current owners.
