# ADR 0047 — Project sidebar and saved chats

Status: Accepted
Date: 2026-09-22
Task: A008-0155
Decision owner: Owner request, recorded by Codex (operator)

## Decision

The owner's project-sidebar screenshots are adopted as presentation and
interaction input: registered folders, nested saved chats, new-chat control and
a project-details popover. All chrome follows ADR 0038 semantic theme tokens.
The yellow annotations and source application's actual data are not product UI.

This refines ADR 0030 and ADR 0046's single-current-conversation limit: each
standalone registered project can retain multiple canonical conversations and
select one for its current workspace session. Existing committed content is
migrated additively. Selecting a chat settles/closes the old workspace session,
updates the selected identity and hydrates a fresh ephemeral session through the
existing shared runtime. It never executes or replays a prompt.

`ProjectConversationStateStore` remains the sole persistence owner. The new
`A008_project_chats` table keys canonical content by namespace/conversation;
`A008_project_chat_selection` holds only the selected identity. The old
`A008_project_conversation` row is retained as a migration snapshot and is no
longer read/written after that namespace's selection has been initialized.
Summaries derive from canonical first-user-message text, without model calls.
Renderer state contains no alternate durable transcript.

New chat retains other chats. Reset and explicit model change retain their
existing semantics for the selected chat, replacing its identity/content; other
saved chats remain intact. Pending images normalize under ADR 0046 on restore.
Memory-disabled projects retain existing in-process-only storage behavior, which
the details popover explicitly reports. No new global memory attachment is made.

Pin and display name are metadata in the existing project registry. Editing
cannot change project ID, root, memory binding, repository files or configuration.
Generic ACP/V2 sessions, their execution authority and recovery remain unchanged.

## Consequences

Users can navigate projects/chats without leaving the sidebar. Host-owned
authenticated V1 sidebar/update/chat routes and SDK helpers serve the bundled
GUI; existing project routes remain compatible. No chat deletion, sync,
concurrent-writer support, folder move or provider-backed title generation is
introduced. The existing standalone workspace remains globally selected per host.
