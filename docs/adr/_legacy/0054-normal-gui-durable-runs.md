# ADR 0054 — Normal GUI durable execution

Status: Accepted
Date: 2026-09-27
Decision owner: Rickard, through the A008-0187 implementation instruction

## Decision

Normal standalone GUI chats use the existing PlatformStore and coordinator, with
the conversation/worktree ownership adopted in ADR 0053. A browser selects what
it observes; selection is stored per tab and is not a project-runtime setting.
New writable chats provision one worktree before exposing the conversation.

The standalone GUI authenticates through its existing V1 origin/PIN boundary at
`/v1/chat/v3/*`. This facade reuses V3 resource handlers and schemas. It assigns
the server-owned `owner_gui` principal; clients cannot supply that authority.
Native engine panels remain on their existing session adapter. Public `/v3`
retains device/PIN authentication and its text-only execution adapter.

The first normal chat request opens the existing exclusive Platform backend at
the configured path, or `platform.sqlite` beside the project registry. Both
surfaces share that single backend. The GUI does not require visiting Platform
or opting in through an environment variable.

GUI-owned runs borrow the registered project runtime and use an EngineHost tool
session with the run's immutable workspace CWD. Repository, shell, MCP and
image-generation tools use the existing implementations and approvals.
Permissions are host-owned pending requests; loss of an observer does not resolve
them. A current authorized GUI client may answer them. Live activity is transient;
committed conversation/run state remains the SQLite authority.

Cancellation is explicit. Coordinator timeout, lease fencing and shutdown policy
still apply. Unknown dispatched effects remain `needs_reconciliation` and are
never retried implicitly. A008 retains semantic-memory authority.

## Consequences

- Switching chats/projects and disposing a browser observer cannot close the
  coordinator's EngineHost session or change its CWD.
- Model/reset start a new isolated conversation; existing history remains intact.
- Legacy V1 history stays in its original store; this slice does not migrate it
  or replay it through semantic extraction.
- V3 text input remains the durable request format. Native image attachments,
  manual image controls, undo and per-conversation generation configuration are
  not yet exposed by the normal durable adapter; unsupported controls fail visibly.
  The model's image-generation tool is retained and settled before answer commit.
- Semantic memory stays project-scoped. Disabling project memory does not disable
  durable chat history.

## Verification

A008-0187 creates three real Git worktrees, runs two approved tool loops under one
SQLite-backed project runtime, checks coordinator capacity, switches chat/project,
disconnects both submitters, then observes and approves completion from a fresh
normal GUI client. GUI tests cover late observation and disconnect during admission.
