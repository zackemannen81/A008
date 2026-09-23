# A008-0170 — Instruction inline template

Task ID: A008-0170
Parent Task: None
Status: Ready
Owner: ChatGPT (operator/worker)
Created: 2026-09-23
Charter frozen at: 2026-09-23
Branch: codex/a008-0170-instruction-inline-template
Clone: C:\code\A008-workers\A008-0170

## Goal

Render a strict set of A008-owned `{{...}}` runtime fields inside global
Instructions before provider invocation, while keeping Instructions in the
system role and keeping the active user message exclusively in the user/memory
envelope.

## In scope

- Support `provider_model`, `model_capabilities`, `working_directory`,
  `is_git_repo`, `platform`, `os_version`, and `today_date`.
- Accept optional whitespace inside braces.
- Use actual project cwd in multi-project/runtime paths.
- Reject unknown placeholders instead of consulting environment variables.
- Preserve the existing default-system fallback and memory context instruction
  composition rules.

## Out of scope

- Persisting or installing the operator's prompt text.
- Generic Mustache/Handlebars support.
- Environment-variable expansion.
- Duplicating tool schemas or MCP catalogs into Instructions.
- Changes to memory retrieval/extraction semantics.
- ACME changes.

## Definition of Done

- A configured Instructions template renders the seven approved fields per turn.
- Rendered Instructions remain `role: system`; the user envelope contains only
  its existing version/retrievedContext/message data.
- `You are a helpful AI assistant.` remains fallback-only when no base system
  instruction exists.
- Project-scoped EngineHost/ACP sessions render the bound project cwd.
- Unknown placeholders fail explicitly.
- Focused tests, typecheck/build, full test and diff hygiene pass.

## Necessity Gate

Contract: PROJECT_BRIEF PC-01, PC-03 and frozen instruction direction under ADR
0035. Global Instructions already own base system behavior; the requested
runtime fields cannot work without a bounded render step. Smallest sufficient
change: one pure allowlisted renderer plus cwd plumbing and focused tests.

No live provider verification is required. Budget: 0 calls / 0 SEK.
