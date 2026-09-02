# File Structure

```text
a007/
|- AGENTS.md                         entry point and safety rules
|- README.md                         public project overview
|- LICENSE                           Apache License 2.0 for a007-owned content
|- .gitignore                        secret, build, provenance, and input bounds
|- .env.example                      non-secret local credential template
|- package.json                      Node package, scripts, exports, CLI metadata
|- package-lock.json                 exact npm dependency graph
|- tsconfig.json                     strict ESM TypeScript build
|- src/
|  |- index.ts                       public core/provider exports
|  |- cli.ts                         terminal composition root
|  |- acp/
|  |  |- a007-acp-agent.ts           injectable ACP session/event bridge
|  |  |- prompt-content.ts           baseline ACP prompt normalization
|  |  `- server.ts                   stdio ACP executable composition root
|  |- core/
|  |  |- chat-invocation.ts          ephemeral context, history window, and exact request budget
|  |  |- types.ts                    provider-neutral chat contracts
|  |  |- errors.ts                   typed error taxonomy
|  |  |- model-registry.ts           verified model profiles and lookup
|  |  `- chat-session.ts             transactional in-memory conversation
|  |- identity/
|  |  |- types.ts                    branded IDs and ACP binding repository port
|  |  |- errors.ts                   runtime identity error taxonomy
|  |  |- runtime-id.ts               canonical v1 parser and UUIDv4 factory
|  |  `- in-memory-binding-repository.ts  atomic ACP binding reference adapter
|  |- memory/
|  |  |- types.ts                    memory state, policy, repository, and projection ports
|  |  |- errors.ts                   deterministic memory error taxonomy
|  |  |- coding-agent-policy.ts      no-decay exact-match reference policy
|  |  |- serialization.ts            stable projection JSON and UTF-8 measurement
|  |  |- in-memory-repository.ts     atomic transaction-serialized reference store
|  |  |- memory-engine.ts            reconciliation, discovery, history, and projection service
|  |  |- retrieval-types.ts          planner, candidate-store, scoring, and evidence contracts
|  |  |- deterministic-retrieval-planner.ts  bounded provider-free message classifier/planner
|  |  |- hybrid-retrieval-policy.ts  explicit channel weights, limits, and thresholds
|  |  |- hybrid-memory-reader.ts     deduplicated scoring and read-only projection funnel
|  |  `- sqlite-memory-repository.ts durable local canon, audit, FTS5, and retrieval indexes
|  |- orchestration/
|  |  |- memory-prompt-composer.ts   ID-free materialized memory/user envelope
|  |  |- memory-aware-chat-session.ts verified read-before-one-chat-call coordinator
|  |  |- post-output-knowledge-intake.ts reasoning-free bounded proposal staging
|  |  |- post-output-memory-coordinator.ts sequential batch/checkpoint/repair ownership
|  |  |- relation-candidate-source.ts bounded indexed current-candidate materialization
|  |  |- relation-gated-memory-commit.ts ID-free guarded five-way write coordinator
|  |  |- semantic-operation.ts          optional shared cancellation context
|  |  `- semantic-json-model.ts         stateless strict-JSON transport owner and adapters
|  |- benchmark/
|  |  `- memory-loop.ts              fake-provider/actual-SQLite two-turn proof
|  |- providers/
|  |  `- nvidia/
|  |     |- nvidia-chat-transport.ts  NVIDIA fetch adapter and response mapping
|  |     |- reasoning-normalizer.ts   SSE channel-transition reasoning isolation
|  |     `- sse.ts                    chunk-safe SSE data parser
|  `- runtime/
|     |- nvidia-session.ts            NVIDIA credential and transport owner
|     |- local-runtime-config.ts      SQLite, identity, and debug settings
|     |- debug-trace.ts               opt-in secret-safe JSONL observer
|     |- user-assertion-gate.ts       runtime-owned new-memory activation
|     `- local-memory-runtime.ts      CLI/ACP memory composition root
|- test/                              fake/local chat, ACP, memory, retrieval, identity, and orchestration tests
|  |- fixtures/
|  |  |- fake-nvidia-server.ts        loopback runtime-proof SSE fixture
|  |  |- nvidia-live-reasoning-leak.json  live Nemotron channel-leak characterization
|  |  `- nvidia-live-relation-alias.json  live classifier relation-vs-type payload
|  `- fake-nvidia-server.test.ts      fixture success and auth rejection
`- docs/
   |- AGENT_CANVAS_INTEGRATION.md     Custom ACP operator boundary and runbook
   |- SEMANTIC_MEMORY.md              implemented v0 memory contract and limits
   |- HYBRID_MEMORY_READ_PATH.md      implemented SQLite hybrid read-path contract
   |- MEMORY_AWARE_CHAT_ORCHESTRATION.md  implemented bounded application read path
   |- MEMORY_LOOP_BENCHMARK.md        deterministic read/chat/commit/reread proof
   |- POST_OUTPUT_KNOWLEDGE_INTAKE.md implemented reasoning and proposal-staging boundary
   |- POST_OUTPUT_MEMORY_COORDINATOR.md implemented sequential partial-outcome boundary
   |- RELATION_GATED_MEMORY_COMMIT.md implemented candidate/relation/write/index boundary
   |- SEMANTIC_JSON_MODEL_CALLS.md      implemented stateless semantic call boundary
   |- LOCAL_MEMORY_SURFACES.md        implemented CLI/ACP memory composition
   |- DEBUG_TRACE.md                  implemented opt-in secret-safe diagnostics
   |- RUNTIME_IDENTITY.md             implemented v0 IDs and ACP binding limits
   |- CURRENT_TASK.md                one active task per branch
   |- template_CURRENT_TASK.md       clean task form
   |- TASK_WORKFLOW.md               lifecycle, freeze, and routing
   |- PROJECT_BRIEF.md               approved direction and open decisions
   |- CONTRIBUTING.md                contribution and source-intake rules
   |- CURRENT_STATUS.md              observed current reality
   |- SYSTEMDOC.md                   implemented durable system
   |- MULTIAGENT.md                  isolated worker and operator policy
   |- THIRD_PARTY.md                 direct dependency provenance and licenses
   |- JOURNAL.md                     append-only work waves
   |- FILESTRUCTURE.md               this repository map
   |- TASK_IDS.md                    task address allocation
   |- evidence/                      indexed safe verification records/artifacts
   |- _legacy/
   |  `- README.md                   tracked boundary for ignored raw provenance
   |- adr/                           durable decisions, indexed
   |- backlog/                       non-activated in-scope proposals, indexed
   |- concepts_sandbox/              non-authority ideas, indexed
   |- paused/                        frozen blocked tasks, indexed
   `- finished/                      immutable task archive by naming convention
```

The local bootstrap bundle, protocol baseline/extraction, raw legacy tree, and
multi-agent add-on source package remain ignored reference inputs. The OpenHands
clone and related prior-work repositories live outside this repository. None
becomes a007 authority merely by existing locally.

The configured external worker-clone root is `C:\code\a007-workers`. It is a
sibling of this repository and is not part of a007's tracked file tree. The
A007-0004 through A007-0015 writing worktrees use task-specific directories
there; A007-0015 is
`C:\code\a007-workers\A007-0015_committed-memory-loop`.
A007-0005 runtime state and browser helpers remain external evidence under the
worker root and are not tracked product structure.

## Addressing

A cited record keeps its path. Status lives in content, never filenames.
Collections declare index or naming-convention discoverability in their README.
Do not cite disposable material from immutable records; restate the needed fact
at a stable owned path first.

## Product paths

`src/core/` is provider- and UI-neutral. Provider adapters live under
`src/providers/`; `src/runtime/` composes environment-owned adapters,
identity/SQLite/debug configuration, and the local memory application root.
CLI and `src/acp/server.ts` are separate I/O composition surfaces; neither owns
a second provider implementation. `src/memory/` is provider- and UI-neutral,
with a locally configured SQLite boundary. `src/orchestration/` owns the
exported verified-context read-before-chat, reasoning-free post-output staging,
stateless semantic JSON calls, sequential post-output coordination, and
relation-gated write/index boundaries. Live CLI/ACP construct those services
only through `createLocalMemoryRuntime`.
`src/benchmark/` contains deterministic local architecture
proofs, not production runtime composition. `src/identity/` owns
opaque runtime routing types and an in-memory binding reference; only canonical
ACP-session generation is integrated today. Compiled `dist/`, dependencies,
`.env.local`, and raw legacy input are ignored and are not repository structure.
