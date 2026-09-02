# Local memory surfaces

Status: Implemented local CLI and A008 ACP composition for the memory-aware
read/chat/post-output loop.

## Boundary

```text
CLI / A008-acp
  -> createLocalMemoryRuntime
     |- NVIDIA credential + one ChatTransport
     |- project-namespaced SQLite
     |- HybridMemoryReader
     |- MemoryAwareChatSession
     |- stateless analyzer/classifier over the same transport
     |- RelationGatedMemoryCommit (sourceMessage → user-assertion gate)
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
- Inspect: any SQLite client against that file; knowledge is JSON payloads
  under the project namespace

## Turn contract

1. Read hybrid memory once with the verified identity envelope.
2. Stream reasoning and answer through the existing chat owner.
3. After the answer is delivered, run post-output staging/commit/index from
   original user text plus final answer only.
4. Attempt one index repair if required.
5. Report memory failure independently. The delivered answer is retained.

`/reset` in CLI clears conversation turns and keeps the same conversation ID
and SQLite namespace.

## New-memory activation

Staged proposals stay dormant at the intake/commit validator. For a `new`
reconcile, the runtime activates the item only when:

- the full normalized proposition is a contiguous substring of the original
  user message; and
- the user message does not end with `?`.

Analyzer confidence cannot grant activation. Assistant-only or question-only
extraction remains dormant.

## Write-path reinforcement

After Compare, `restatement` and `extend` add `LIVE_RECONCILIATION_REINFORCEMENT`
(`0.2`) to `relevanceScore`, then re-evaluate
`keepAlive || score >= activationThreshold`. Already-active items get stronger.
Dormant items reactivate only when that boosted score meets the threshold;
otherwise they stay dormant after the boost.

Hybrid reads use `projectSelected` with `LIVE_PROJECTION_REINFORCEMENT` `0`.
Retrieval does not reinforce, reactivate, weaken, or decay. Cyclic decay is
not implemented.

Live hybrid read has no `embeddingProvider` and constructs
`DeterministicRetrievalPlanner()` with empty `knownTags`/`knownDomains`.
Candidate recall is therefore entity/exact plus lexical FTS. Vector RAG and
planner tag/domain channels remain optional adapters. Relation-write candidate
search can still use tags/domains from the staged proposal.

Validated `restatement`/`extend` currently boost whether the supporting text
came from the user message or the assistant answer. Restricting that boost to
user-backed evidence is a later policy.

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

- `NVIDIA_API_KEY` is required only for live chat. Automated tests never load
  `.env.local` and never call a paid endpoint.
- Local SQLite and optional JSONL traces may contain prompts, answers, and
  extracted propositions. They are ignored by Git. Delete them after testing.
- Raw traces additionally persist reasoning and semantic JSON. Treat the file
  as sensitive local content.

Agent Canvas uses the same compiled `A008-acp` command. See
`docs/AGENT_CANVAS_INTEGRATION.md` and `docs/DEBUG_TRACE.md`.
