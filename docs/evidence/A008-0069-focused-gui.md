# A008-0069 — Focused GUI verification

Date: 2026-09-07

## Automated gates

- `npm --prefix gui run build`: passes TypeScript and Vite production build.
- `npm --prefix gui test`: 89 reported tests, all pass.
- `git diff --check`: passes.
- Backend suites not repeated: no backend, protocol or provider code changes.

## Browser evidence

Production GUI served by the real standalone host and ACP process, using the
existing isolated session-control provider fixture. No live provider calls.
Checked at 1254 × 620, 1440 × 900 and 390 × 844.

- Empty state renders with neutral tokens, sidebar and integrated composer.
- Connect obtains a real isolated session and displays its working directory.
- A draft survives Chat → Tools → Chat.
- Workbench opens and closes; Repository, Terminal and Upload stay reachable.
- Repository shortcut requests read_file and list_files. Both permission dialogs
  are actionable; approved calls return real fixture directory observations and
  the final assistant answer appears in the chat.
- Narrow-screen workbench occupies the main area. Repository shortcut returns
  to the chat; the panel becomes hidden and the reply is visible.
- Mobile navigation reaches Memory; Overview, Relationship map and Knowledge
  manager render against the empty isolated store.
- Model, Budgets and Instructions sections remain reachable on a narrow screen.
- Closing parameters restores keyboard focus to the initiating model button.
- Screenshots inspected for empty, completed chat, workbench and mobile layouts.
- No horizontal document overflow in checked mobile memory/chat views.

An old mobile rule initially hid the opened workbench; removed and reverified
through the actual approved tool flow. Browser artifacts remain outside Git.
This is browser verification, not an installed desktop application proof.
