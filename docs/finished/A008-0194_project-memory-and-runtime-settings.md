# A008-0194 — Project memory view and host-owned runtime settings

Task ID: A008-0194
Status: Complete
Owner: ChatGPT (operator)
Completed: 2026-09-28

## Goal

Restore two GUI surfaces regressed by the ADR-0055 durable-session migration:
project-sensitive Memory and global Semantic/Budgets/Instructions settings.

## Delivered

- MemoryPage receives the selected durable `projectId`.
- The memory client includes `projectId` in `/v1/memory` requests.
- The host resolves that project through the shared `ProjectRuntimeRegistry` and
  calls the matching runtime's `inspectMemory`.
- Legacy callers without `projectId` keep the existing bridge fallback.
- The GUI host exposes host-owned runtime preferences GET/POST endpoints.
- DurableChatClient loads/saves/reloads global preferences without a session
  process and exposes them to Parameters even when no conversation exists.
- Semantic/Budgets/Instructions no longer depend on `session.details` being
  populated by an agent/session inspect snapshot.

## Verification

- Root typecheck: PASS.
- GUI typecheck: PASS.
- Focused memory/settings host tests: 26/26 PASS.
- Full GUI suite: 216/216 PASS.
- `git diff --check`: PASS.
- No live provider calls; 0 SEK.

See `docs/handoffs/A008-0194.md`.
