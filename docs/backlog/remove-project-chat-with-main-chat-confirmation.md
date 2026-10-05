# Remove a project chat with main-chat confirmation

Status: Activated as A008-0210; paused before implementation

## Context

Project chats represent durable conversations/sessions, while **Discard** currently
applies to the parallel session's Git worktree and retains its conversation
history. There is no separate user-facing action to remove an old chat from the
project list and delete its persisted conversation record.

## Outcome

Provide an explicit way to remove a project chat/session and its persisted chat
history so it no longer appears in that project's chat list. This is distinct
from discarding a worktree. Before any permanent removal, A008 must show a
confirmation in the **main chat** and require the user to click **Yes** there.
A confirmation shown only in the target chat, a parallel session, or another
client context is insufficient. Cancel, dismiss, timeout, stale confirmation,
or any response other than an explicit main-chat Yes must leave the chat intact.

The eventual charter must specify how the associated workspace is handled and
must prevent silent loss of uncommitted workspace changes. It must also define
safe behavior for active runs and multiple connected clients before deletion is
implemented.

## Why this is paused

A008-0210 is claimed on `main` and has a task charter, but implementation is
paused before runtime changes. Current durable storage binds conversations to a
project/workspace but does not identify a main/root conversation versus
parallel/worker conversations. The authenticated host principal identifies a
client/user, not the role of the chat where a confirmation was clicked. A
renderer-only dialog would therefore not enforce the required gate against a
parallel client or direct host request.

Rickard approved the host-owned native OS dialog as the explicit confirmation surface for this separate A008-0211 project-lifecycle scope. This does not amend frozen A008-0210, whose main-chat Yes gate remains unchanged. A008-0212 is the active prerequisite to establish durable host-owned main identity and prove an authenticated out-of-band host-to-broker channel; the native dialog alone is not a secure boundary. The A008-0210 parent remains paused pending that implementation; no deletion behavior has been added.

