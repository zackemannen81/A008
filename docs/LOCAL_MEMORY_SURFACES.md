# Local memory surfaces

Status: Implemented local CLI and A008 ACP composition for the memory-aware
read/chat/post-output loop.

## Boundary

Engine mode reuses this composition once per canonical workspace within its
process, selected by the real ACP `cwd`. Native client chat and A008 panels share
the same store and session. See [ENGINE.md](ENGINE.md) for project paths and
explicit legacy attachment. Stop other owners before attaching an existing store;
cross-process exclusive ownership is not implemented.

Global budgets and instructions are separate from project memory; see
[RUNTIME_SETTINGS.md](RUNTIME_SETTINGS.md). Retrieval scope is an enabled semantic
operation, with actual invocation coverage. Provider errors/cancellation do not
silently manufacture successful scope results. Instructions enter chat only;
tool transcripts and reasoning stay outside post-output extraction.

```text
CLI / A008-acp
  -> createLocalMemoryRuntime
     |- NVIDIA credential + one ChatTransport
     |- project-namespaced SQLite knowledge store
     |- KnowledgeMemoryReader
     |- MemoryAwareChatSession
     |- stateless analyzer/classifier over the same transport
     |- KnowledgeEngineCommit (ACCEPT user-assertion-v1; classifier as comparator)
     `- PostOutputMemoryCoordinator
```

CLI and ACP share this root. They do not construct a second NVIDIA client or
read credentials below composition. Core modules remain environment-neutral.

## Local identity

| ID | Lifetime | Source |
| --- | --- | --- |
| project | stable namespace | `A008_PROJECT_ID`, or `A008-project-id` beside the SQLite file, or generated once |
| agent | process | `A008_AGENT_ID` or generated at runtime start |
| conversation | CLI process / ACP session | generated |
| task | one turn | generated |

These IDs are routing state. They are not placed in provider messages,
committed dialogue, semantic JSON, or canonical propositions.

Agent Server conversation binding and load/resume remain unimplemented.

## SQLite

- Default path: `~/.A008/memory.sqlite`
- Override: `A008_MEMORY_SQLITE_PATH` as an absolute path outside the
  repository, or `:memory:` for tests
- The parent directory is created if needed
- Reset: delete the SQLite file, WAL/SHM sidecars, and `A008-project-id`
- Inspect: any SQLite client against that file; live knowledge is the
  `A008_knowledge_*` record families under the project namespace. V0
  `A008_memory_knowledge` rows, if present, migrate into intervals with
  unknown boundaries.

## Turn contract

1. Read hybrid memory once with the verified identity envelope.
2. Stream reasoning and answer through the existing chat owner.
3. After the answer is delivered, run post-output staging/commit/index from
   original user text plus final answer only.
4. Attempt one index repair if required.
5. Report memory failure independently. The delivered answer is retained.

`/reset` in CLI clears conversation turns and keeps the same conversation ID
and SQLite namespace.

## New-memory acceptance

Staged proposals are untrusted. `ACCEPT` policy `user-assertion-v1` accepts a
claim only when:

- the full normalized proposition is a contiguous substring of the original
  user message; and
- the user message does not end with `?`.

Analyzer confidence cannot accept. Assistant-only or question-only extraction
remains asserted, not accepted, and does not open current state. ACCEPT does
not write `keepAlive`, strength, or activation onto bindings.

## Write-path reinforcement

`restatement` / re-assertion runs named `REINFORCE` on evidence only. State
bindings have no `relevanceScore`. `PROJECT` writes nothing. Direct
slot/entity/exact matches ignore evidence dormancy. Associative expansion
still omits dormant evidence with reason `associative_dormant`. Cyclic decay is
not implemented.

Live read uses the knowledge engine, not the v0 hybrid `KnowledgeItem` funnel.
The planner still exists as a compatibility helper for the identity envelope.
Vector RAG remains an unused v0 adapter.

## Operator test from a clean install

```powershell
Set-Location C:\code\A008
npm ci
npm run build
npm test
```

CLI with ignored local credentials and isolated SQLite:

```powershell
Copy-Item .env.example .env.local
# set NVIDIA_API_KEY in .env.local
$env:A008_MEMORY_SQLITE_PATH = "$env:TEMP\A008-memory\memory.sqlite"
npm run cli -- chat
```

Cost, credential, and data expectations:

- `NVIDIA_API_KEY` or `KIE_API_KEY` is required for live chat. Automated tests
  never load `.env.local` and never call a paid endpoint.
- Local SQLite and optional JSONL traces may contain prompts, answers, and
  extracted propositions. They are ignored by Git. Delete them after testing.
- Raw traces additionally persist reasoning and semantic JSON. Treat the file
  as sensitive local content.

Agent Canvas uses the same compiled `A008-acp` command. See
`docs/AGENT_CANVAS_INTEGRATION.md` and `docs/DEBUG_TRACE.md`.
