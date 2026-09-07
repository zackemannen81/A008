# A008-0068 — Standalone GUI repository tools verification

Date: 2026-09-07
Environment: Windows; Node/TypeScript runtime and Chromium browser.
Provider: deterministic loopback fixture only. No paid/live provider calls.

## Automated gates

- Root build/typecheck and GUI typecheck/production build passed.
- `npm test`: 464 core + 4 repeated membership + 89 GUI = 557 passing;
  zero failures, skips or cancellations.
- Extended native/standalone tests then rerun: 10/10 passed, including a denied
  GUI write and a filename containing semicolon, space and quote passed as
  literal Git argv. Final host workspace default handling: host suite 32/32.
- UTF-8 BOM, Unicode and CRLF preserved; existing-file creation, stale SHA-256,
  ambiguous replacement, traversal, symlink escape and direct Git metadata
  access refused. Oversized file reads fail visibly.
- Full standalone GUI-host → spawned ACP → shared runtime → provider continuation
  executes read AGENTS.md, list root, create file, reread revision, edit file,
  Git status and shell verification in an isolated temporary repository.
  Seven approvals precede seven completed operations. Actual file content and
  actual Git stdout are asserted at the next provider request.
- A second standalone turn rejects a write through the GUI permission response;
  the provider observes denial and the file is never created.
- Existing MCP discovery/execution, shell denial, malformed schemas, cancellation,
  timeout, bounded observations and transient tool-history tests pass.
- Tool observations and transient reasoning are absent from semantic requests;
  synthetic credentials are absent from GUI frames.

## Browser gate

Used agent-browser 0.36.0 against a standalone production-GUI host and a local
synthetic provider, with separate temporary memory and repository files.

- Connect loads the actual cwd and six native tool definitions.
- Tools → Repository opens the full-width workbench.
- Read AGENTS.md & list root switches to chat; read_file and list_files each
  open the actual modal and continue only after Allow once.
- Final answer and two completed tool activity entries render.
- Browser errors output is empty.
- 390 × 844 viewport renders all navigation and action buttons without horizontal
  document overflow. Desktop and mobile screenshots inspected.
- Screenshots and transient driver/logs remain outside the tracked repository
  under the task-named A008-workers paths; no personal paths/images are committed.

## Limits

No installed desktop/package release, remote Git mutation, third-party source
import, external-client modification or live model capability claim. No general
GUI MCP server manager, manual IDE editor, Codex tool API compatibility or
filesystem sandbox is claimed. Saved coding instructions were not modified.
