# ADR 0046 — Durable project conversation restore

Status: Accepted
Date: 2026-09-21
Task: A008-0147
Decision owner: Operator

Refines ADR 0041 and ADR 0045.

## Context

The standalone GUI opens registered projects through a workspace switch that closes the current process-local session and creates a new one. That preserves Stage-4 session authority but currently leaves the chat empty when the same project is reopened. The operator requires project selection/open to reconstruct its conversation history.

ADR 0041 deliberately excluded durable chat while Stage 4 established process-local resume and restart uncertainty. A008-0147 adds a narrower product guarantee without turning ACP/V2 transport sessions into durable identities.

## Decision

1. The standalone GUI workspace has one current canonical conversation per registered project.
2. That current conversation is durable in the project's existing SQLite owner, keyed by project namespace. It stores conversation identity, selected chat model and canonical committed messages only.
3. ACP/V2 session IDs, resume capabilities, command receipts, thought streams, permissions and tool execution remain process-local. Restart still invalidates session resume authority.
4. Reopening a project creates a new ephemeral session and hydrates that session's chat from the durable project conversation.
5. Generic ACP/V2 new sessions remain fresh/independent; workspace restore is an explicit internal composition mode, not global `session/new` behavior.
6. Explicit model change starts a new conversation and replaces the persisted current project conversation, matching existing UI semantics.
7. Reset, undo, committed turns and generated-image state transitions update the same canonical persisted conversation.
8. Generated-image media remains source-store referenced. A stale persisted `pending` generation is terminalized on restore and never replays a chargeable provider operation.
9. Renderer/localStorage state is never an alternate transcript owner.

## Consequences

- Project A→B→A and host restart can reconstruct A's committed text/images without reusing an old ACP session.
- Stage-4 reconnect/resume and unknown-outcome semantics remain truthful because execution/session authority is not persisted.
- This decision does not add multiple conversation tabs, offline sync, cross-device sync or concurrent writers.
- ADR 0041's blanket “no durable chat” statement is superseded only for the standalone workspace current-project conversation. Its session/receipt/resume process-local constraints remain authoritative.
