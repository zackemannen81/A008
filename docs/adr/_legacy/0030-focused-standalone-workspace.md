# ADR 0030 — Focused standalone workspace

Status: Accepted
Date: 2026-09-07
Task: A008-0069
Amends: ADR 0021 D1/D2 and ADR 0022 D1/D2, following ADR 0029

## Decision

The owner requests a usable standalone A008 GUI inspired by their supplied
Codex desktop screenshot. A008 retains its own identity and implementation.
No third-party UI code, assets, conversation list or unsupported product
features are copied or implied.

The default workspace has left navigation, a neutral charcoal palette and a
centred conversation with an integrated composer. Repository, Terminal and
Upload remain accessible on Tools, with an optional workbench beside Chat.
Narrow screens show one surface at a time and offer a navigation toggle.
Runtime diagnostics and thought content are collapsed until opened.

Chat and workbench remain mounted when hidden so navigation preserves existing
drafts and session state. Existing workbench tab mounting semantics remain.
Model settings, budgets, persistent instructions, memory inspection and tool
approvals continue to use the shared engine contract.

## Consequences

Standalone usability is explicitly in scope again. External integrations still
use the same host contract. This changes presentation and local UI state only;
it does not introduce persisted conversation management or change permissions.
Shared colour tokens stay in `a008.css`; `workspace.css`, loaded after feature
styles, owns standalone composition and responsive presentation.
