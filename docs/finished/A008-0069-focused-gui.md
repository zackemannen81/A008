# A008-0069 — Focused standalone GUI

Status: Complete
Owner: Codex (operator)
Date: 2026-09-07

## Goal and primary deliverable

Give the standalone A008 GUI a calmer workspace inspired by the owner's Codex
client screenshot: neutral dark surfaces, sidebar navigation, a spacious chat,
an integrated composer and an optional right tools panel.

## Scope

GUI shell, design tokens, chat/composer presentation, responsive navigation,
collapsed runtime diagnostics, owning documentation and browser verification.
Retain all session commands, model/budget/instruction controls, memory views,
repository tools, terminal, upload and permission dialogs.

## Out of scope

Provider/runtime changes, persisted multi-conversation history, third-party UI
code, external client changes, packaging, publication and live provider calls.

## Definition of done and minimum gates

- Desktop and narrow-screen navigation reach every existing surface.
- Chat drafts survive navigation; hidden tools do not consume conversation width.
- Neutral palette and readable conversation/composer follow the supplied reference.
- GUI tests, typecheck/build and deterministic browser flow pass.
- Record actual checks, archive charter, write handoff and restore CURRENT_TASK.

## Authority

Owner request and screenshot in this task. Branch starts from the owner's
committed A008-0068 checkpoint; that prerequisite is not yet merged into main.

## Completion

Implemented and verified. See [evidence](../evidence/A008-0069-focused-gui.md)
and [handoff](../handoffs/A008-0069.md). GUI build/typecheck and 89 tests pass.
No provider/runtime changes or live calls.
