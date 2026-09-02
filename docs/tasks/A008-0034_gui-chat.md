# Task A008-0034 — GUI chat transcript

Status: Ready
Owner: A008-worker03
Parent: A008-0030
Branch: `grok/A008-0034-gui-chat`
Clone: `C:\code\A008-workers\A008-worker03`

## Write scope

- `gui/src/chat/**` only
- `docs/handoffs/A008-0034.md`
- `docs/finished/A008-0034_gui-chat.md`

## Goal

A008 chat transcript: user messages, assistant answer, streaming thought as a
separate channel (display-only). Consume `useGuiSession` props from the stub
contract. Canvas-like UX, A008 copy. No OpenHands components.

## Gates

- Thought never mixed into committed answer text in the DOM contract
- Restore CURRENT_TASK template, handoff, PR, do not merge
