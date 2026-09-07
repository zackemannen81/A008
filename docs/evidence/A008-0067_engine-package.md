# A008-0067 — Engine package verification

Task: A008-0067
Status: Verified locally
Date: 2026-09-07
Boundary: actual local engine/client host and isolated shell/MCP/filesystem work;
synthetic provider requests only. No installed Electron or live-provider claim.

## Revisions and artifact

- A008 implementation: `649a32db3ef913271c0c0defa5125ed93f049430`.
- Companion client: `5b0abb2`, branch `codex/A008-0067-engine-panels`, based on
  `a0fcb06` (equal to origin/main when inspected).
- Portable directory: `C:\code\A008-workers\A008-0067-engine-win32-x64`.
- ZIP: `C:\code\A008-workers\A008-0067-engine-win32-x64.zip`, 77687903 bytes.
- SHA-256: `8d911d596005ef42ec2629d83a82c057ca8ea17b81bf3ec9bbe6b6f62e3ef139`.
- Fresh ZIP extraction: `C:\code\A008-workers\A008-0067-extracted-final\A008-0067-engine-win32-x64`.
- Build inventory: sourceDirty false, Windows x64, Node v24.14.1, 100 production
  packages. Node/dependency notices and React/React DOM/scheduler licenses included.
  Owner prompt, settings, credentials, memory and source checkout are excluded.

## Automated gates

- Root `npm test`: 462 core + 4 repeated membership + 87 GUI = 553 passing executions,
  zero failures/skips. Root typecheck/build and GUI typecheck/build pass. A final
  GUI test rerun after adding a test type guard passed all 87 cases.
- Companion `npm run typecheck`, `npm test` (590 passing), `npm run build`: pass.
- Engine tests verify shared panel/session/history/settings/project memory,
  authenticated HTTP/WS, disconnect preservation, isolated projects, explicit
  legacy attachment, model metadata and close invalidation.
- Tool tests exercise actual shell write/read, structured JSON and SSE fragments,
  provider result continuation, no tool-transcript history, denial, invalid
  arguments, duplicate IDs, call/input budgets, pending-approval cancellation,
  actual timeout/process termination, UTF-8 truncation and actual stdio MCP.
- Version 1 settings migration retains instructions and original budgets without
  rewriting on read; explicit saves use version 2 with revision protection.
- `node scripts/verify-engine-package.mjs <fresh-extraction> <companion-checkout>`:
  pass. The exact package Node binary and engine run through actual companion
  discovery/CoreRuntimeHost. Only Electron window broadcasting is stubbed. Proof
  reaches ACP, the shared panel/history, native per-action approval, actual file
  execution, next provider tool observation, upload/memory, panel disconnect and
  EOF shutdown; the old HTTP listener is unreachable after stop.

Raw synthetic logs and local screenshots remain outside Git under
`C:\code\A008-workers\A008-0067-evidence` and task-named log files beside it.

## Browser gate

The companion's `test/fixtures/engine-panel-browser.*` imports the actual
EnginePanels and EngineToolPermissions components. The local fixture uses the
actual CoreRuntimeHost and extracted engine with a synthetic loopback provider.
Browser actions were performed through CUA, not inferred from component source.

Verified panel auto-connect to the native session; shared history; model settings
2048 reasoning budget / 0.4 temperature; global instruction save/reopen; actual
512-byte input failure and repair to 131072 without losing the draft; Memory
Overview, stored-link graph, record/provenance inspector and Knowledge Manager;
synthetic text upload marked Extracted; tool request from inside the iframe and
from the native chat path; Reject (file absent), Allow once (actual file content
and exit 0); reopened panel showing completed activity; and `/exit` removing the
panel descriptor in the client. Reject focus was corrected and verified.
The first synthetic fixture answered with a fixed success sentence even after
denial; denial proof therefore uses the failed activity and absence of the file,
not that fixture sentence. The production engine returned a denied tool result.

Desktop 1280 × 900 and narrow 390 × 844 layouts were inspected. Mobile instruction
editing and save/reload controls remain accessible. Console error list was empty.
The browser proof used the first package build; the final ZIP was separately
revalidated through the actual host after the final source and documentation build.
Test tabs/processes were closed and temporary viewport overrides reset.

## Limits

No installed Windows Ship gate, live model quality, paid provider, remote MCP,
cross-process store lock or filesystem sandbox is claimed. The engine offers
stdio MCP and host shell execution with explicit approval. Existing side effects
cannot be undone by cancellation. Use one engine owner per data directory.
The existing client installation needs the companion source changes in its next
build; discovering the engine does not upgrade an older client automatically.
No push, PR, merge, deployment or publication was performed.
