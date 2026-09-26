# Current Task

Task ID: A008-0185
Parent Task: None
Status: Draft
Owner: Rickard
Created: 2026-09-26
Last updated: 2026-09-26
Charter frozen at:

## Read First

AGENTS.md
docs/TASK_WORKFLOW.md
docs/PROJECT_BRIEF.md
docs/CONTRIBUTING.md
docs/CURRENT_STATUS.md
docs/SYSTEMDOC.md
docs/JOURNAL.md
docs/FILESTRUCTURE.md
docs/adr/0053-Multi-Session-Worktree-Architecture.md
docs/finished/A008-0177_parallel-project-worktree-sessions.md
docs/finished/A008-0178_parallel-sessions-gui.md
docs/finished/A008-0179_parallel-worktree-runtime-and-ux.md
Current Platform V3 conversation/run contracts
Current ProjectWorkspaceStore
Current Platform coordinator/run lease implementation
Current EngineHost session/CWD ownership

## Task Summary

Complete the multi-project / multi-conversation execution model so that A008 is no longer conceptually bound to one active project, one active workspace or one foreground client session.

A008 must support:
- multiple registered projects at the same time;
- multiple independent conversations within each project;
- one isolated Git worktree per writable conversation;
- multiple simultaneously running conversations and runs;
- background execution that continues when the originating UI window disconnects, switches project or closes;
- multiple A008 clients/windows observing and controlling the same durable host state without becoming execution owners.

The durable ownership chain shall be explicit:

Project
  → Conversation
    → Workspace
      → Run

A project owns shared runtime identity and semantic memory.
A conversation owns its selected workspace.
A run executes against the workspace bound to its conversation.
A client/UI observes and controls these durable resources but does not own their lifetime.

### Problem Statement

A008 already contains most of the required architecture:
ProjectWorkspaceStore can create isolated Git worktrees.
A008-0179 established that one project runtime/memory namespace should be shared across parallel sessions while tools use session-specific CWDs.

EngineHost already supports session-scoped cwd.
Platform V3 already has durable conversations, runs, queueing, leases, recovery and a background coordinator.
The remaining ownership gap is that the Platform V3 conversation/run model has no durable workspaceId.
Workspace selection currently exists beside the conversation model and can influence a bridge/current workspace rather than being an immutable property of the conversation being executed.
This prevents A008 from reliably supporting several chats in one project where each chat has its own isolated worktree.
Foreground websocket/session ownership also must not define run lifetime. A run accepted by the durable Platform coordinator must continue independently of whichever GUI/client originally submitted it.

### Goal

Make each writable project conversation a durable execution context bound to its own isolated workspace, while keeping project memory/runtime shared and making run lifetime independent of client lifetime.

The resulting model must allow several projects, conversations, worktrees and runs to execute concurrently through one durable local A008 host.

### Primary Deliverable

Implement a durable relationship:

projectId
  → conversationId
    → workspaceId
      → workspacePath
        → runId

such that:
- each conversation resolves its workspace deterministically;
- tools execute from that workspace;
- project semantic memory/runtime remains shared by projectId;
- accepted runs are owned by the Platform coordinator rather than a websocket/UI connection;
- multiple clients can observe/control the same resources concurrently.

Ownership Model

A008 Host
The local A008 host is the durable authority.

It owns:
project registry;
project runtimes;
semantic memory;
conversations;
workspace metadata;
run queue;
run leases;
active/background execution;
durable run state.

There should not be one complete runtime owner per GUI window.

Project

A project owns:
project identity;
registered root repository;
semantic memory namespace;
provider/runtime composition;
project-level settings.
Exactly one logical project runtime/memory owner exists per projectId.
Parallel conversations must not create competing project-memory owners.
Conversation
A conversation owns:
conversationId;
projectId;
workspaceId;
durable chat history;
conversational state.

For writable Git projects, normal new conversations should receive their own isolated worktree.

Changing which conversation is visible in the UI must not mutate another conversation's workspace binding.

Workspace

A workspace owns:
workspaceId;
projectId;
workspace mode;
filesystem path;
branch;
base branch;
lifecycle/disposition.

The worktree is execution isolation, not a separate semantic-memory namespace.

Run

A run owns one execution attempt.

A run shall retain:

runId;

projectId;
conversationId;
resolved workspaceId;
model;
lease/execution state;

terminal outcome.
workspaceId on the run is execution provenance.

Once a run is accepted, its workspace identity must not change because the user changes tabs, projects or windows.

Client / UI

A client owns only presentation and control state.

A client may:
open projects;
open conversations;
observe runs;
submit runs;
explicitly cancel runs;
reconnect to existing durable state.

Client disconnect, window close or project switch must not implicitly cancel a durable run.

Required Architecture

1. Add durable workspace ownership to conversations

Extend the Platform V3 conversation model with:
workspaceId: string
or the equivalent strict typed identifier.
The binding must be durable in the Platform store.
A conversation's workspace may not depend on a process-global or GUI-global "currently open workspace".
Existing conversations must receive a deterministic migration/default behavior.
No silent rebinding of an existing conversation is allowed.

2. Record workspace provenance on runs

Extend Platform V3 runs with:

workspaceId: string
At run creation, copy the conversation's current authoritative workspace ID onto the run.
This value becomes immutable execution provenance for that run.
The coordinator must resolve execution CWD from the run/conversation workspace relationship rather than from current GUI selection.

3. One writable conversation → one isolated worktree

For registered Git projects, creating a normal writable conversation should perform the equivalent atomic workflow:

create conversation identity
→ create worktree
→ persist workspace
→ bind conversation.workspaceId
→ expose conversation to client

The worktree should use the existing ProjectWorkspaceStore.

Do not duplicate Git lifecycle logic.

Default topology:

Project A
├── Conversation A → Worktree A
├── Conversation B → Worktree B
└── Conversation C → Worktree C

The primary repository checkout is the project base/operator workspace and merge target, not the default writable checkout for every chat.

A shared/read-only workspace mode may remain where explicitly required, but must not be the implicit mutable workspace for parallel conversations.

4. Preserve one project runtime / memory namespace

Opening or executing a conversation worktree must reuse the registered runtime for its projectId.

Do not open a second semantic-memory owner merely because the CWD differs.

Required separation:

ProjectRuntime
  projectId = P1
  semantic memory = P1

Conversation A
  workspace = WT-A
  tool CWD = WT-A

Conversation B
  workspace = WT-B
  tool CWD = WT-B

Both conversations use the same project semantic runtime while their file/tool execution remains isolated.

5. Bind EngineHost/tool CWD per conversation/run

When preparing execution:

run.workspaceId
→ ProjectWorkspaceStore
→ workspacePath
→ EngineHost session CWD
→ tool/process CWD

This binding must occur from durable identifiers.

It must not come from:

currently selected GUI project;

last-opened workspace;

process-global CWD;

"next session" mutable bridge state.

Runtime snapshots should expose the resolved CWD/workspace identity for inspection.

6. Detach run lifetime from UI/WebSocket lifetime

A submitted Platform V3 run is owned by the Platform coordinator.

After successful run creation:

client → createRun()
             ↓
        durable run row
             ↓
         coordinator
             ↓
           worker

The originating client may disappear without cancelling the run.

These actions must NOT cancel an accepted run:

closing an A008 window;

navigating to another project;

navigating to another conversation;

WebSocket disconnect;

another client opening the conversation;

browser refresh.

Only an explicit run cancellation or host shutdown/recovery policy may alter execution.

7. Multiple clients / windows

Support multiple simultaneous UI/native/browser clients against the same host.

Examples:

Window 1 → Project A / Conversation A
Window 2 → Project A / Conversation B
Window 3 → Project B / Conversation A

All three may submit or observe independent runs.

No window owns:

project runtime;

memory namespace;

conversation lifetime;

workspace lifetime;

run lifetime.

Client subscriptions are observers.

8. Concurrency rules

Parallel runs are allowed across different conversations subject to existing coordinator capacity limits.

At minimum:

Project A / Conversation 1 / WT-1 / Run A
Project A / Conversation 2 / WT-2 / Run B
Project B / Conversation 1 / WT-3 / Run C

must be able to execute concurrently without CWD contamination.

Existing conversation-level serialization may remain if required by current revision/history semantics.

Two runs must never accidentally share mutable filesystem state unless they intentionally reference the same workspace.

In Scope

Platform V3 schema changes for conversation/workspace and run/workspace identity.

Platform store persistence/migration.

Conversation creation → worktree provisioning/binding.

Run creation workspace provenance.

Coordinator workspace resolution.

EngineHost/tool CWD binding from durable workspace identity.

Detaching accepted run lifetime from client connection lifetime.

Multi-client observation of durable runs.

Recovery behavior for workspace-bound queued/running runs.

GUI adjustments required to represent conversation/worktree ownership.

Regression tests covering multi-project, multi-conversation and concurrent CWD isolation.

Current-state documentation updates.

Out of Scope

Automatic merge to main.

Automatic branch deletion.

Automatic push.

Automatic Pull Request creation.

Remote Git mutation.

Cross-machine distributed execution.

Cloud worker scheduling.

Changing semantic-memory ownership model.

Creating separate memory namespaces per worktree.

Replacing ProjectWorkspaceStore.

Replacing Platform V3 coordinator/lease architecture.

Full Git conflict-resolution UX.

Automatic cleanup of dirty worktrees.

Large redesign of provider/model routing.

These may be separate follow-up tasks.

Required Invariants

Identity

projectId != workspaceId != conversationId != runId

Each identifier has one owner and one meaning.

Memory

semantic memory namespace = projectId

Never workspaceId.

Never conversationId unless explicitly scoped conversational state is involved.

Filesystem

tool CWD = workspacePath(run.workspaceId)

Never "current GUI project".

Run provenance

Once accepted:

run.workspaceId

is immutable.

Client lifetime

client disconnect != run cancellation

Project runtime

Multiple worktrees of one project must reuse one logical project runtime/memory owner.

Isolation

Two conversations with different workspaceIds must not write through the same worktree path.

Desired User Experience

Project sidebar:

A008
├── Chat: Fix memory retrieval
│   ├── branch: a008/session-ab12
│   └── running
│
├── Chat: GUI cleanup
│   ├── branch: a008/session-cd34
│   └── idle
│
└── Chat: Provider work
    ├── branch: a008/session-ef56
    └── running

Another project may simultaneously show:

NES Demo
├── Chat: Sprite loader     running
└── Chat: Audio experiment  idle

Switching between them changes only what the client displays.

It must not switch execution CWD for already-existing conversations/runs.

Conversation Creation Flow

For a writable Git project:

User chooses New Chat
        ↓
host allocates conversationId
        ↓
ProjectWorkspaceStore.createWorktree(projectId)
        ↓
workspaceId + workspacePath + branch
        ↓
conversation persisted with workspaceId
        ↓
conversation returned to client

If workspace provisioning fails, conversation creation must fail atomically or leave an explicitly recoverable state.

Do not create a normal writable conversation silently pointing at the primary repository after worktree creation fails.

Run Creation Flow

createRun(conversationId)
        ↓
load conversation
        ↓
resolve projectId + workspaceId
        ↓
validate workspace exists/is usable
        ↓
persist run with workspaceId
        ↓
enqueue
        ↓
return runId immediately

Execution later performs:

run.workspaceId
        ↓
workspacePath
        ↓
shared ProjectRuntime(projectId)
        ↓
EngineHost/session with workspace CWD
        ↓
tools/model execution

Background Execution Contract

A run reaches queued before returning success from run creation.

After that point the run belongs to the host/coordinator.

The UI may reconnect later and query:

getRun(runId)
events(...)
getConversation(conversationId)

to reconstruct current state.

A websocket may provide live delivery but must not be required for execution continuity.

Recovery Contract

After host restart:

queued runs remain discoverable;

existing Platform lease recovery rules remain authoritative;

expired running leases are reconciled using existing Platform semantics;

conversation → workspace binding survives;

workspace path is re-resolved from workspaceId;

A008 must not silently execute a recovered run against another workspace;

missing/deleted workspace must produce an explicit deterministic failure/reconciliation state.

Do not recreate a worktree silently for an already-accepted run.

GUI Requirements

The GUI should present conversations as the primary unit.

Workspace/worktree information is contextual metadata attached to the conversation.

At minimum display, where relevant:

project;

conversation title;

branch;

workspace status;

running/queued/idle state.

A user should not have to manually "Open workspace" before chatting.

Selecting a conversation is enough to restore its workspace context.

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: 6c847ee6054fb7ff8d5e6000a92c64d1492bbd9b9

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: 6c847ee6054fb7ff8d5e6000a92c64d1492bbd9b9

Change

Accepted constraint

Outcome / consequence if omitted

Smallest sufficient change

Planned check

Durable conversation → workspace binding

local-first parallel project sessions

Chat CWD remains dependent on mutable/global workspace selection

Add workspaceId ownership to durable conversation state

persistence + restore tests

Run workspace provenance

deterministic execution/replay

Run may execute against whichever workspace is current later

Persist immutable run workspaceId

run creation/restore tests

Project runtime reuse

one project semantic owner

parallel worktrees create competing memory owners

resolve runtime by projectId, CWD by workspace

registry/runtime tests

Detached run ownership

background execution

closing/switching UI interrupts useful work

coordinator owns accepted runs

disconnect/background test

Multi-client observation

several A008 windows/projects

client becomes hidden authority

clients subscribe/read only

two-client integration test


### Definition of Done

The task is complete when all of the following are demonstrated:

A project can contain at least three conversations, each bound to a distinct worktree.

Two conversations in the same project use the same project semantic runtime/memory namespace.

Their tool CWDs are different and correspond to their own worktrees.

A second project can execute concurrently without affecting the first.

At least two runs from different conversations can remain active concurrently.

Closing/disconnecting the client that submitted a run does not cancel that run.

Another client can reconnect and observe the run's current/terminal state.

Changing selected project or conversation does not change an existing run's workspace.

A run records its workspace identity durably.

Restart/recovery never silently rebinds a run to a different workspace.

No process-global/current-GUI workspace selection participates in execution authority.

Existing semantic-memory ownership remains project-scoped.

Worktree Git lifecycle continues through ProjectWorkspaceStore.

Relevant protocol, store, coordinator, EngineHost and GUI tests pass.

Current documentation reflects the implemented ownership model.

Required Regression Scenarios

Scenario A — Same project, parallel conversations

Create:

Project P1
Conversation C1 → Workspace W1
Conversation C2 → Workspace W2

Run both concurrently.

Assert:

C1 tool cwd == W1.path
C2 tool cwd == W2.path
C1 projectId == C2 projectId
C1 memory runtime == C2 memory runtime
W1.path != W2.path

Scenario B — Different projects

Create:

P1/C1/W1
P2/C2/W2

Run both.

Assert project runtime, memory namespace and workspace isolation.

Scenario C — Client disconnect

Client A creates run R1.

After R1 enters queued or running, disconnect Client A.

Assert R1 continues.

Client B opens the same conversation and observes R1 completion.

Scenario D — UI navigation

Run R1 in Project A / Conversation A.

While running:

switch UI → Project B
open Conversation B
submit R2

Assert R1 remains bound to its original project/workspace.

Scenario E — Host recovery

Persist a conversation/workspace and run metadata.

Restart host.

Assert:

conversation retains workspaceId;

workspace resolves to same path;

run provenance remains unchanged;

existing lease/recovery rules apply;

no fallback to primary repository occurs.

Scenario F — Missing workspace

Delete or invalidate a workspace belonging to an existing conversation/run.

Assert explicit failure/reconciliation.

Never silently substitute:

project.rootFolder

as execution CWD.

Minimum Verification Gates

root typecheck

protocol schema generation/verification

Platform V3 store tests

coordinator queue/lease tests

project workspace tests

EngineHost/project-runtime reuse tests

concurrent same-project worktree CWD test

concurrent cross-project test

client disconnect/background-run test

host restart/recovery test

GUI conversation/workspace restore tests

git diff --check

No live provider call is required for the core acceptance proof unless deterministic fixtures cannot demonstrate a required ownership boundary.

### Verification Budget

Live verification purpose / required provider behavior: Not required for primary architecture verification.
Budget owner / parent allocation: N/A
max_live_verification_cost: 0 SEK
max_live_verification_calls: 0

If a later implementation step genuinely requires live-provider verification, amend the task explicitly before dispatch.

Implementation Guidance

Prefer extending the existing owners:

ProjectWorkspaceStore owns worktree lifecycle.

Platform store owns durable conversation/run relationships.

Platform coordinator owns background run execution and leases.

Project runtime registry owns one logical runtime per project.

EngineHost/session owns execution CWD/tools.

GUI/client owns presentation and subscriptions only.

Do not introduce a second scheduler, a second worktree registry, or a second project-memory owner.

The intended result is composition of existing owners, not replacement.

Key Architectural Rule

The system must resolve execution context from identity:

runId
→ conversationId
→ workspaceId
→ workspacePath
→ session/tool CWD

and cognition from project identity:

runId
→ projectId
→ ProjectRuntime
→ semantic memory

Those two paths intentionally converge only at execution.

That separation is the central invariant of this task.

Handoff / Follow-ups

Likely follow-up tasks after this one:

merge worktree into base branch;

create PR from conversation/worktree;

dirty-worktree close/cleanup UX;

branch/worktree retention policy;

background-run tray/status UI;

optional per-project concurrency controls;

remote/distributed workers.

These must not be absorbed into this task unless separately chartered.
## References

- `docs/PROJECT_BRIEF.md` at `6c847ee6054fb7ff8d5e6000a92c64d1492bbd9b9`
- `docs/TASK_WORKFLOW.md`
- `docs/adr/0053-Multi-Session-Worktree-Architecture.md`
- `docs/finished/A008-0177_parallel-project-worktree-sessions.md`
- `docs/finished/A008-0178_parallel-sessions-gui.md`
- `docs/finished/A008-0179_parallel-worktree-runtime-and-ux.md`
- Current Platform V3 protocol, store, coordinator/lease, `ProjectWorkspaceStore`, `EngineHost`, and project-runtime registry implementations

## Checklist

- [ ] Re-read current contract, accepted architecture decisions, Platform V3 and workspace/runtime owners; record exact implementation boundaries.
- [ ] Define and migrate durable conversation and run workspace identity in protocol and platform storage.
- [ ] Provision and persist one isolated writable workspace per new writable Git conversation using `ProjectWorkspaceStore`.
- [ ] Resolve coordinator execution CWD from persisted run/conversation workspace identity while reusing the project runtime by project ID.
- [ ] Preserve accepted-run ownership across client disconnect, navigation and concurrent client observation.
- [ ] Update GUI conversation/workspace presentation and restore behavior.
- [ ] Add and run the frozen verification gates, including concurrent same-project/cross-project isolation and recovery cases.
- [ ] Update current-state documentation and write handoff/archive records at completion.

## Decisions and Notes

- Draft prepared from operator-provided pre-draft on 2026-09-26.
- Task ID A008-0185 is claimed on `main`; the charter remains editable until the operator marks it Ready.
- Execution changes require the task to reach Ready before implementation or delegation.

## Charter Amendment Log

- none

## Verification

- [x] Task identity allocated in `docs/TASK_IDS.md`.
- [x] Charter contract revision pinned to `6c847ee6054fb7ff8d5e6000a92c64d1492bbd9b9`.
- [x] Draft contains frozen-scope candidates, necessity arguments, definition of done, regression scenarios, and minimum gates for Ready review.
- [ ] Implementation verification is pending Ready.

## Documentation Updates

- [x] `docs/TASK_IDS.md`
- [x] `docs/CURRENT_TASK.md`
- [ ] `docs/CURRENT_STATUS.md` at implementation completion.
- [ ] `docs/SYSTEMDOC.md` at implementation completion.
- [ ] `docs/JOURNAL.md` at integration completion.
- [ ] `docs/FILESTRUCTURE.md` if structure changes.
- [ ] ADRs and collection indexes if a new durable architecture decision is required.

## Handoff and Follow-ups

- Current state: A008-0185 is a complete Draft charter on `main`, ready for operator Ready review.
- Next recommended step: operator reviews the frozen scope and changes status to Ready before delegation or implementation.
- Blockers: none for charter readiness.
- Child tasks: none.
- Resume condition: operator marks the charter Ready.
- Open questions: determine the smallest implementation/delegation slices after Ready without changing the frozen outcome.