# System Document

This document describes durable behavior that exists now. Intended product
architecture belongs in `docs/PROJECT_BRIEF.md` until implemented.

## Implemented system

A008 implements a repository control plane and its first bounded application
surfaces:

```text
owner direction
  -> one active task with frozen scope
  -> repository-owned authority documents
  -> bounded work and verification
  -> current status + decisions + journal + immutable archive
  -> next actor resumes from repository state
```

The task ID register allocates stable addresses on `main`. Each branch has at
most one active task. Ready freezes the charter. Discoveries route to the task,
a bounded child, backlog, or concepts sandbox.

## Current source boundary

```text
A008 repository authority
  |- tracked docs and decisions
  |- provider-neutral chat core, NVIDIA adapter, CLI, and ACP bridge
  |- semantic-memory contracts, service, hybrid reader, and repositories
  |- memory-aware application orchestration and bounded prompt composition
  |- post-output staging, stateless semantic calls, sequential coordination,
  |  relation commit, and benchmark
  |- runtime identity contracts and ACP binding reference repository
  `- tracked provenance boundary documents

local/external evidence (not A008 authority)
  |- docs/_legacy/agenten007  raw CLI, ignored and secret-bearing
  |- C:\code\OpenHands         MIT Agent Canvas source clone
  |- owner Context-First doc   source input; A008 memory v0 now exists
  |- C:\code\acme             related prior work; not an adopted baseline
  `- bootstrap/protocol/add-on reference packages
```

External source becomes A008 behavior only through a claimed task that pins its
revision, records its license, imports or adapts a bounded surface, verifies the
result, and updates this document.

## Application runtime

```text
CLI / A008-acp -> createLocalMemoryRuntime
  |- NVIDIA credential + one ChatTransport
  |- project-namespaced SQLite knowledge store
  |- KnowledgeMemoryReader (DEFINE..PROJECT; writes nothing)
  |- MemoryAwareChatSession
  |- stateless analyzer/classifier (classifier is a comparator)
  |- KnowledgeEngineCommit (INGEST/ACCEPT/RECONCILE/UPDATE)
  `- PostOutputMemoryCoordinator
                 |
                 v
          ChatTransport
            -> NvidiaChatTransport
               -> traced fetch
                  -> NVIDIA endpoint
```

`ChatSession` owns in-memory conversation history. It constructs a pending turn,
calls the transport, and commits user plus assistant messages only after a valid
completion. Transport failure leaves prior history unchanged.

An optional invocation plan can add ephemeral system context, substitute the
provider-visible current user content, bound the outgoing committed-dialogue
tail, and enforce a hard measurement budget over stable JSON serialization of
the exact role/content array. The committed pending turn still uses the
original normalized user text. Direct callers without a plan retain existing
behavior.

Core contracts own provider-neutral messages, options, deltas, completions,
usage, errors, model metadata, and the transport port. Core imports do not read
environment variables or terminal state.

`createNvidiaChatTransport` remains the credential/transport owner. It
validates `NVIDIA_API_KEY`, resolves the optional trusted endpoint override,
and constructs `NvidiaChatTransport`. `createNvidiaChatSession` still returns a
bare `ChatSession` for tests and direct callers.

CLI chat and A008 ACP now use `createLocalMemoryRuntime`, which calls that
transport owner once and injects the same transport into answer and semantic
calls. Identity, SQLite path, and debug settings are read only at this outer
composition.

`NvidiaChatTransport` owns NVIDIA payload mapping, authorization header,
stream/non-stream response parsing, timeout/cancellation, and provider error
classification. Fetch, endpoint, and timeout are injected at construction. It
implements no fallback or retry policy.

Live Nemotron streams may emit only a short prefix on `reasoning_content` and
continue the same chain-of-thought on `content` before the user-visible answer.
The transport normalizes those channel transitions so reasoning never becomes
`message.content` or content deltas. Semantic JSON calls use a dedicated
non-thinking generation profile and never inherit chat `enableThinking` or
`reasoningBudget`. Intake receives only `verifiedFinalAnswer`. Successful chat
with failed post-output is a degraded memory outcome, not a failed chat turn.

The CLI is one composition surface. `models` and help work without a key. `chat`
uses the shared memory runtime, streams reasoning to stderr and answers to
stdout, then awaits post-output settlement. Memory failures print to stderr
without failing the delivered answer. Slash commands (`/help`, `/exit`,
`/quit`, `/reset`, `/clear`, `/undo`, `/history`, `/model`, `/status`, `/cwd`,
`/tools`, `/shell`, `/!`) are handled in the CLI and never sent to the model.
`/shell` runs a local process in `process.cwd()` through `runTerminalCommand`.
`@langchain/community` is not a dependency.

## Agent Canvas ACP surface

`A008-acp` uses the official `@agentclientprotocol/sdk` 1.4.0 stable-v1 stream
implementation on stdin/stdout. It creates an independent in-memory
`ChatSession` for each ACP session, creates a canonical versioned A008
`acp_session` runtime ID, exposes the one verified model as a session config
option, converts text and non-fetched resource links into a bounded chat turn,
maps reasoning/content deltas to standard ACP thought/answer chunks, and
propagates cancellation through `AbortSignal`. Failed or cancelled turns retain
the prior committed history. Malformed or duplicate injected IDs are rejected
before the process-local session map changes.

Agent Server is the process owner and protocol client. Agent Canvas is the
external UI that configures a Custom ACP command and renders Agent Server
events. A008-0005 observed this exact chain in real local Canvas 1.16.0 and Agent
Server 1.44.1 processes: a browser prompt reached the compiled bridge, the
existing adapter called a loopback fake endpoint, Canvas rendered the expected
answer, and Agent Server finished the conversation. The external repositories
remain unmodified and outside A008 authority.

On the verified Windows path, Custom ACP commands use forward-slash absolute
paths (`C:/code/...`); backslashes were consumed as shell escapes. The standard
`dev:minimal` launcher also timed out at 30 seconds before the backend's observed
42-second readiness. Starting its exact locked Agent Server and Vite commands
separately is the documented development fallback, not an A008 product runtime.

The ACP process supports no tools, filesystem operations, permission prompts,
MCP, rich prompt media, load/resume, authentication method, or runtime model
switching. Local SQLite memory is now composed per process with one session
conversation. Canonical ACP session identity is still ephemeral and is not
bound to Agent Server's conversation identity because the current new-session
request does not provide that external handle.

Each ACP session opens one local memory conversation under the process project
and agent. Protocol thought/answer/cancellation behavior is unchanged. Memory
diagnostics never enter ACP stdout. Debug traces, when enabled, use an
explicit JSONL file.

All A008 model-inference evidence uses injected fake fetch responses or the
loopback HTTP fixture. No live model call or paid usage has been made or
claimed. The external Canvas/Agent Server proof did trigger optional OpenAI
subscription control-plane checks and failed title generation without
credentials; therefore it does not prove globally blocked external egress.

## A008 GUI host

`src/gui-host/` is the A008-owned Node process that makes the shared core
reachable from a browser without Agent Server. It is the product path in
ADR 0019 D2. `npm run gui-host` starts it against an already-built GUI;
`npm run gui` builds `gui/` first and then starts it on one origin.

The host serves `gui/dist` as static content when that directory exists, and
answers three HTTP routes:

```text
GET  /health    -> { ok: true, name: "A008-gui-host" }
GET  /v1/models -> { models: [{ id, name }] }
POST /v1/shell  -> { stdout, stderr, exitCode, timedOut, truncated }
```

`POST /v1/shell` delegates to the existing `runTerminalCommand` in
`src/tools/terminal.ts`, so the GUI terminal and the CLI `/shell` command share
one implementation and one working directory. The renderer never executes a
command itself.

`WS /v1/session` is bridged to an `A008-acp` stdio subprocess that the host
owns. Frames follow ADR 0019 D4 exactly: the client sends `session/new`,
`prompt`, and `cancel`; the host answers `session/new/ok`, `thought`, `answer`,
`prompt/ok`, and `error`. Reasoning arrives as `thought` frames and is never
concatenated into an `answer` frame. No Agent Server schema and no OpenHands
TypeScript client participate.

Credentials stay in the host process. `NVIDIA_API_KEY`, the optional endpoint
override, and memory settings are read from process environment only. Outbound
text is redacted so neither a credential value, the literal token
`NVIDIA_API_KEY`, nor the string `authorization` reaches the renderer; the
trade is that an answer legitimately discussing those names is shown redacted.

Two guards protect the shell surface. Any request carrying an `Origin` that is
neither same-origin nor loopback is refused with 403 on every route and on the
WebSocket upgrade, which is what stops a cross-origin page from reaching
`/v1/shell` through a simple form post that would skip a CORS preflight.
`POST /v1/shell` additionally requires `application/json`. Clients that send no
`Origin`, and the Vite dev proxy on loopback, are unaffected.

An ACP failure is reported with its real reason recovered from the SDK error
details, and a host that cannot start `A008-acp` appends the subprocess stderr
tail, so an unset credential or a malformed runtime ID is diagnosable from the
GUI instead of surfacing as a generic internal error.

Sessions are owned per socket and released on disconnect. Each `session/new`
frame records its session against the socket that asked for it; when that
socket closes, the host aborts any in-flight prompt and issues ACP
`session/close` for every session that socket owned. `A008AcpAgent` implements
that method — aborting the active turn, dropping the session state, and failing
closed on a session it does not hold — and advertises
`sessionCapabilities.close` from `initialize`. The host reads its existing
bridge binding rather than starting one, so a socket that never opened a
session cannot spawn an ACP subprocess on its way out, and it contains release
failures because a close path has no client left to tell. Release is
disconnect-driven only: there is no idle timeout or reaper, so a socket that
never closes cleanly holds its sessions until the process exits.

A008-0030 proved this chain end to end against a real host process, a real ACP
subprocess, the real local memory runtime, and a loopback fake endpoint. See
`docs/evidence/A008-0030_gui-runtime-proof.md`.

## A008 GUI client

`gui/` is an A008-owned Vite + React + TypeScript application. It follows Agent
Canvas UX but imports no `@openhands/*` package, no Canvas route, and no
telemetry. `gui/src/app.tsx` is the shell; each feature module owns only its own
directory per ADR 0019 D7.

`useGuiSession` in `gui/src/session/` is the browser client for host protocol
v1. It owns one socket per mount, resolves its URL from `location` so the
production single-origin path and the dev proxy both work, and publishes
status, `sessionId`, model, separate `thought` and `answer` buffers, `error`,
`connect`, `prompt`, and `cancel`. It does not connect on mount; the settings
pane offers an explicit Connect action. The hook-facing `connect` settles rather
than rejecting, because the settings pane fires it and forgets it, while the
underlying client still rejects for programmatic callers. Failure is carried by
`status` and `error`.

`gui/src/chat/` renders user text, the assistant answer, and streaming thought
as three distinct DOM channels, with the thought channel display-only. A
rendered-DOM test asserts that the answer node's text equals the answer exactly
and that thought text appears exactly once in the document, inside the thought
node. Turn commits go through a pure reducer, so a buffer clear after a new
prompt cannot land a duplicate assistant turn.

`gui/src/composer/` carries the A008-0029 slash set, `gui/src/terminal/` calls
`POST /v1/shell` rather than executing anything in the browser, and
`gui/src/settings/` plus `gui/src/brand/` own the shell chrome and A008
identity. No provider call, credential, or telemetry ships in the renderer.

## Semantic-memory core

The memory capability is an independent provider-neutral application surface
now constructed by local CLI/ACP composition:

```text
local CLI/ACP composition
  |- write -> PostOutputMemoryCoordinator
  |          |- PostOutputKnowledgeIntake (once)
  |          |  `- model-backed analyzer ----.
  |          `- KnowledgeEngineCommit (sequential per proposal)
  |             |- model-backed ID-free classifier as comparator ----.
  |             `- INGEST + ACCEPT + RECONCILE/UPDATE
  |                                                |
  |                      shared stateless generator <--'
  |                              `- existing ChatTransport
  `- read  -> KnowledgeMemoryReader
             |- DEFINE / RETRIEVE / EXPAND / FILTER / COMPOSE / PROJECT
             |- direct slot/entity/exact match ignores lifecycle
             `- PROJECT writes nothing; sectioned payload mapped to envelope

Knowledge SQLite (live)
  |- SqliteKnowledgeStore (interval, evidence, lifecycle families)
  `- v0 A008_memory_knowledge rows migrate into unknown-bounded intervals

v0 compatibility
  |- InMemoryMemoryRepository
  `- SqliteMemoryRepository (KnowledgeItem canon/audit)

separate control query -> v0 memory audit events
separate history query -> slot interval list (live) or supersede chain (v0)
```

Live knowledge state is current open bindings (`validTo = null`) plus closed
intervals for history. Evidence lifecycle is `active`/`dormant` on utterances,
claims, events, and artifact summaries only. `KnowledgeItem`
`current`/`superseded` plus `active`/`dormant` remains the v0 compatibility
record; live CLI/ACP do not write it.

`SemanticMemory.reconcile` applies caller-supplied `new`, `restatement`,
`extend`, `supersede`, or `conflict` decisions. It performs no extraction,
semantic classification, provider call, network access, or environment read.
Restatement preserves the canonical ID/proposition and reinforces the existing
item; extend uses the caller-approved enriched proposition; supersede retains a
linked historical item; conflict records audit without changing canon.
An optional expected-revision guard is validated inside the same repository
transaction before any transition or audit mutation; stale, missing, or
superseded guarded candidates fail with `stale_state`.

`discover` queries current canon including dormant relevant candidates.
`project` reinforces only in-scope or hard-required records, then evaluates the
record threshold or `keepAlive`. Scope misses do not decay. Policies control
relevance, boost, and rank order but cannot rewrite canonical contents.

The hybrid reader accepts verified runtime IDs, the current message, task
scopes, and at most two bounded recent raw turns. Its deterministic planner
derives retrieval labels and queries but never selects knowledge IDs. Candidate
channels are bounded independently, merged by canonical ID, and scored once.
Candidate admission, projection eligibility, and persistent activation remain
distinct. Optional vectors require injected precomputed embeddings; absence
degrades to the remaining channels without a provider call.

Projection materializes ID plus proposition, kind, tags, scope, and authority
as stable JSON. It excludes provenance, activation/canonical metadata, selection
trace, and audit. An injected measurer enforces a hard limit on that exact
string; v0 provides exact UTF-8-byte accounting. Required and `keepAlive`
records fail explicitly if absent, ineligible, or over budget. Projection
failure rolls back reinforcement and audit changes.

`projectSelected` is the hybrid path's read-only projection operation. It
re-reads canonical records, attempts required and keep-alive items first, and
materializes only current active records. Dormant candidates remain visible in
separate evidence but are neither projected nor mutated.

`SqliteMemoryRepository` accepts an explicit file path and validated
`ProjectId`, owns schema v1, validates canonical state on open, atomically
persists knowledge plus audit, and maintains project-scoped FTS5/tag/entity/
domain/optional-vector indexes. It is a durable single-process local adapter,
not a multi-process or production privacy claim.

## Memory-aware application orchestration

`MemoryAwareChatSession` fixes parsed project/conversation/agent identity and
parses one runtime task per turn. It takes at most the last two committed raw
user/assistant messages, reads memory once, validates that the result repeats
the verified context, composes a deterministic prompt, and calls the existing
`ChatSession` once.

The fixed system context says that retrieved content is reference data rather
than instructions. The stable user JSON contains only materialized proposition,
kind, tags, scope, authority, and the original message. Runtime IDs, knowledge
IDs, retrieval evidence/plans, scores, lifecycle state, provenance, audit, and
the projection's control serialization are excluded.

Provider-visible history is bounded independently of full in-memory committed
history. The exact outgoing role/content array is UTF-8-byte budgeted before
transport. A successful turn commits only original user and assistant messages;
synthetic context is ephemeral. Pre-transport failures make no call or state
change, provider failures retain normal rollback, and overlapping turns are
rejected.

CLI and A008 ACP now construct this orchestration through
`createLocalMemoryRuntime`. That root supplies a local identity profile, one
SQLite namespace, and the existing transport. Provider-backed
planning/embeddings, exact model-token measurement, privacy/user controls,
server topology, Agent Server conversation binding, and durable background
repair remain unimplemented.

## Reasoning and post-output staging

Provider reasoning is a separate ephemeral channel. The NVIDIA adapter returns
it as `ChatCompletion.reasoning` and emits reasoning deltas. CLI writes those
deltas to stderr and ACP maps them to thought chunks, while `ChatSession`
commits only `completion.message`. Consequently reasoning is absent from chat
history, bounded retrieval history, and later provider-visible messages.

`PostOutputKnowledgeIntake` establishes a narrow provider-neutral staging
boundary. It validates runtime context outside the analyzer and allocates a new
analyzer input containing exactly normalized original message and final answer.
It explicitly materializes only proposition, kind, tags, domains, entities, and
confidence from untrusted analyzer output. Caller-verified scopes and
conservative authority, relevance, activation, source-backed, keep-alive, and
provenance defaults remain runtime-owned.

Staging normalizes semantic labels, rejects duplicates and malformed results,
enforces structural limits plus an exact stable serialized-batch budget, and
returns defensive proposal batches. It has no repository, memory service,
provider, environment, or network port and therefore cannot write canon or
indexes. The separate concrete analyzer adapter delegates a strict JSON call to
an injected stateless generator; automatic/background integration remains a
later boundary.

## Stateless semantic JSON model calls

`ChatTransportSemanticJsonGenerator` owns history-free structured model work
over one injected existing `ChatTransport`. It constructs exactly one fixed
system message plus one stable `{ operation, input }` user envelope, measures
the exact serialized role/content array, forces non-streaming mode, and makes
one transport call. It does not use `ChatSession`, so semantic prompts and
responses cannot become committed dialogue.

`ModelBackedPostOutputKnowledgeAnalyzer` supplies only normalized original
message and final answer. `ModelBackedKnowledgeRelationClassifier` supplies the
existing exact ID-free proposal/candidate envelope. Both may share one generator
and therefore one transport/model configuration without constructing another
provider implementation or credential owner.

Only non-empty strict JSON assistant content is returned. Provider reasoning,
usage, and finish metadata are ignored; fenced or prose-wrapped JSON fails
closed. Parsed results remain untrusted until the existing intake and relation-
gate validators explicitly materialize allowed fields and handles.

An optional `SemanticOperationContext` forwards one `AbortSignal` from process
or resume through the relevant semantic port to `ChatRequest.signal`. Analysis
cancellation remains `staging_failed`; classification cancellation remains
`commit_failed` at the same proposal checkpoint. Local CLI/ACP composition
injects the existing transport/model/budget and invokes the coordinator after
each delivered answer.

## Relation-gated write orchestration

`IndexedRelationCandidateSource` turns one staged proposal into one bounded,
project/scope-constrained exact/entity, lexical, tag, and domain candidate
search. It uses no semantic vector or provider. Hits are deduplicated and
deterministically ordered, then materialized through `SemanticMemory`; dormant
current items remain valid comparison evidence.

`RelationGatedMemoryCommit` revalidates the staged batch and gives an injected
classifier an exact-budget semantic envelope. Candidate handles are local to
the call. Project/runtime/knowledge IDs, revisions, scores, retrieval reasons,
provenance, audit, history, and provider reasoning are absent. Runtime validates
`new`, `restatement`, `extend`, `supersede`, or `conflict` from field `type` or
alias `relation`, maps only known handles to durable IDs, and passes every
materialized ID/revision into guarded reconciliation. Names are trimmed and
case-folded; JSON `null` is omitted; unknown or conflicting names fail closed
with the returned value.

Canonical SQLite state plus FTS/tag derivations commit atomically. A successful
non-conflict then attempts one staged entity/domain document upsert. The result
is explicitly `updated`, `not_required`, or `pending_repair`; the latter carries
a copied bounded document that `repairIndex` can retry without a second
classifier or reconcile call. One service instance rejects overlapping commit
and repair operations.

The boundary is constructed by the local CLI/ACP composition root over the
shared stateless generator. It processes one proposal per call and does not
solve concurrent semantic-duplicate `new` decisions.

## Sequential post-output coordination

`PostOutputMemoryCoordinator` allocates one exact staging input from task ID,
original message, final answer, and verified scopes, then calls staging once.
It revalidates and copies the returned batch and invokes the relation commit
sequentially by proposal index.

The coordinator returns `completed`, `staging_failed`, `commit_failed`, or
`index_repair_required`. A commit failure checkpoint identifies the same
unprocessed proposal; `resume` does not restage or replay earlier records. A
pending index result is a barrier because later candidate discovery could
depend on missing entity/domain metadata. `repairAndResume` retries only that
document, changes the existing record to `updated`, and continues with the next
proposal without a second classifier or reconciliation for the repaired item.

Checkpoint validation covers identity kinds, exact staged serialization,
contiguous records, next-index range, and latest pending-document consistency.
Containers are copied defensively and one coordinator instance rejects
overlapping operations. Checkpoints are in-memory control state only. Local
surfaces await one turn's post-output, including one automatic index repair;
there is no durable queue, scheduler, or retry timing.

`npm run benchmark:memory-loop` builds a deterministic committed loop over
actual in-memory SQLite and one shared fake transport. It performs chat,
knowledge analysis, relation classification, guarded `extend` plus index
update, then a second chat read. The first turn projects active revision-one
meaning and the second projects revision two under the same canonical ID.
Structural assertions cover exact four-call order, bounded two-message dialogue,
separate reasoning/content, stateless semantic requests, canonical/audit state,
and reasoning/control-ID exclusion. It deliberately does not prove automatic
activation of a brand-new dormant draft. Reported timings are observations, not
guarantees.

## Local CLI and ACP memory composition

`createLocalMemoryRuntime` is the live local composition root. It validates the
NVIDIA credential first, then opens a SQLite file outside the repository,
resolves a stable project ID, migrates any v0 supersede chains into intervals
with unknown boundaries, and wraps one transport for both chat and stateless
semantic calls.

Each CLI process or ACP session gets one conversation ID. Each turn allocates a
fresh task ID, reads the knowledge engine, streams the answer, then awaits
post-output. `ACCEPT` policy `user-assertion-v1` may accept a verified user
assertion; it does not write `keepAlive`, strength, or activation onto state.
Assistant-only extraction stays unaccepted. Restatement `REINFORCE`s evidence
only. `PROJECT` writes nothing. Direct matches ignore evidence dormancy.

Debug tracing is off by default. Safe/raw JSONL files are optional and
secret-redacted. CLI may emit safe `trace>` lines to stderr. ACP stdout stays
protocol-only. HTTP traces carry `httpCallId` and
`operation=chat|knowledge_analysis|relation_classification`. `turn_complete`
records `chatStatus` and `memoryStatus`.

Live read uses `KnowledgeMemoryReader` over SQLite knowledge tables. Direct
matches ignore evidence dormancy. Vector RAG remains a v0 optional adapter, not
live. See `docs/LOCAL_MEMORY_SURFACES.md` and `docs/DEBUG_TRACE.md`.

## Runtime identity core

Runtime identity is an independent control-plane surface:

```text
RuntimeIdentityFactory / parseRuntimeId
  -> A008_v1_<project|conversation|task|agent|acp_session>_<UUIDv4>

complete verified context
  -> AcpIdentityBindingRepository
     `- InMemoryAcpIdentityBindingRepository (reference adapter)

A008-acp session/new -> canonical acp_session ID only
local CLI/ACP composition -> configured project, session conversation,
  process agent, and per-turn task
SQLite memory adapter -> validated project ID as hard namespace
MemoryAwareChatSession -> validated project/conversation/task/agent envelope
```

Runtime IDs are branded by kind for TypeScript and fully parsed at runtime. The
format uses a fixed A008 prefix, v1 marker, kind, and lowercase UUIDv4. It stores
no user, path, prompt, task-description, or other semantic content. Product
runtime task IDs are distinct from docs-first addresses such as `A008-0007`.

`AcpIdentityBinding` links project, conversation, runtime task, agent, ACP
session, and bounded namespaced external references. Registration is idempotent
for an identical binding. ACP session and external handles are unique. Multiple
sessions may share a conversation only with the same project and agent; task
may differ. The in-memory adapter serializes concurrent registrations, commits
working-copy indexes atomically, and returns defensive records.

External references and bindings are routing/control state, not knowledge or
model context. The adapter is not durable. No Agent Server conversation binding
is registered; local CLI/ACP sessions use process/session-generated
conversation, agent, and task IDs under one configured project namespace.
Persistence of those bindings, external intake, lifecycle/migrations,
accounts/ACLs, and load/resume remain unimplemented.

## Multi-agent operation

The repository has a documented multi-agent control policy in
`docs/MULTIAGENT.md`. It defines isolated write units, operator locks, handoff,
and evidence order. Future writing clones or worktrees are allocated under the
external worker root `C:\code\A008-workers`, never inside the canonical
`C:\code\A008` tree. A008-0004 through A008-0015 have allocated worktrees. No
A008-specific process server or hard concurrency enforcement exists yet.

## Security boundary

Git ignore rules contain raw legacy material and common credential files.
The legacy key was revoked/rotated by the owner, but ignoring does not sanitize
the raw source. The replacement key is local environment input and is not read
by core or tests. A008-0005 also left `.env.local` unread and supplied only a
fixed test key plus loopback URL to the ACP process. The ACP process receives
credentials only through its process environment. Its optional endpoint
override is operator-controlled and must not be derived from chat input. Live
calls, host-agent tools, extensions, packaging, and production services remain
unavailable until their tasks define explicit credentials, permissions,
sandboxing, costs, egress, and gates.

The provider-neutral memory logic has no provider, environment, or network
dependency. The optional SQLite adapter is a filesystem/database boundary that
receives its path and project namespace explicitly; it reads no credential or
environment configuration. Provenance is excluded from context but may still
contain sensitive data. The adapter is approved only for local technical proof;
persistent user data remains prohibited until classification, authorization,
encryption, retention, deletion, and export policies are owned.

The memory-aware orchestration code likewise reads no environment, credential,
file, database, or network directly. Its prompt strips routing and memory
control data. Canonical propositions can still contain adversarial text; JSON
data framing and a fixed trust instruction reduce authority confusion but do
not establish complete prompt-injection resistance.

The post-output intake service receives no reasoning or complete provider
result and owns no write port. Its staged drafts remain untrusted. The separate
relation gate exposes only materialized meaning and local handles to its
classifier; it retains control IDs and canonical authority at runtime. The
benchmark and relation tests use in-memory SQLite and fake/local components
only.

The semantic JSON generator can reach a provider only through its explicitly
injected `ChatTransport`; it owns no credential or endpoint. Fixed system
instructions frame operation inputs as untrusted data, exact budgets apply
before transport, and only strict assistant JSON is returned. Provider
reasoning and operational metadata are discarded. This narrows authority but
does not establish model-output truth or complete prompt-injection resistance;
the downstream runtime validators remain mandatory.

The sequential coordinator copies only the already-approved staging input,
keeps checkpoints out of semantic/model context, and treats an incomplete index
as a stop condition. Local composition attempts one repair then reports the
outcome without rewriting the answer. Checkpoints may contain sensitive runtime
correlation IDs and are not authorized for persistence by this slice.

Opt-in debug tracing is off by default. Safe and raw JSONL sinks never record
authorization headers, API keys, or environment dumps. Raw mode may persist
prompts, projected memory, reasoning, answers, and semantic JSON after explicit
opt-in. Trace IDs stay out of model context. ACP stdout remains protocol-only.

The identity core likewise has no provider, environment, filesystem, database,
or network dependency. External references are excluded from model context but
may be sensitive correlation handles; persistent use requires the same owned
privacy, authorization, retention, deletion, and export policies.

## Authority order

When evidence disagrees:

1. Executable or working-tree evidence.
2. `docs/CURRENT_STATUS.md` and this implemented-system document, corrected with
   the same change.
3. Accepted decisions and contracts.
4. The frozen active charter.
5. Agent reports, runtime logs, and chat summaries.
