# Bundled platform surface

Status: Additive GUI page (A008-0167). V1 chat, project chats, reset and model
change stay on their existing paths. This page does not import or migrate
saved chats, and it does not send tools or approvals.

## Page

The workspace navigation gains one Platform control beside Memory, Tools and
Help. The page is mounted only as that view. While it is active it calls
`GET /v3/info` through `createPlatformV3Client`.

`available: false` renders an explicit unavailable state. The page then does
not list conversations and does not start a run.

Resource calls use the same injected fetch and credential adapter style as
`createGuiSessionClient`. The renderer does not store a bearer token.

- When `GET /v2/info` includes the `browser-pin` profile, resource calls use
  the existing PIN cookie. An engine capability token is not sent as app auth.
- When that profile is absent and this client was given a device credential
  adapter (`kind: "bearer"`), that adapter is used.
- Otherwise the page says platform resources require the existing host login
  and does not call V3 resource routes. There is no anonymous V3 access.

The project picker lists projects already returned by the GUI's `GET /v1/projects`.
The page does not register a project. The user may create one V3 conversation
in the selected project and then a text run. The run model is the chat
session's current model. With no model selected, start stays disabled.

Each start click mints one `commandId` and keeps that id, model, text and
expected revision for the Retry control. Failure and `COMMAND_CONFLICT` do not
mint a replacement and do not send another request until Retry. Closing the
page aborts polling only. It does not cancel the run.

Events are polled only while the page is active. The returned run status is
shown as text: queued, running, completed (`succeeded`), cancelled, failed,
`needs_reconciliation`, and `cancel_requested`. A later view of the same
project reads the committed conversation and run through a new client.

## Out of scope

No V1 transcript redirect, no silent migration, no reconciliation control, no
tool or approval UI.
