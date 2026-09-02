# Task A008-0033 — GUI session client

Status: Complete
Owner: A008-worker02
Parent: A008-0030
Created: 2026-09-02
Completed: 2026-09-02
Branch: `grok/A008-0033-gui-session`
Clone: `C:\code\A008-workers\A008-worker02`
Base: `origin/main` (`43d5e3e`)

## Write scope

- `gui/src/session/**` only (replace the stub)
- `docs/handoffs/A008-0033.md`
- `docs/finished/A008-0033_gui-session.md`

Not edited: other `gui/src/*` directories, `gui/src/app.tsx`, `src/gui-host/`,
`docs/JOURNAL.md`, `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`,
`docs/FILESTRUCTURE.md`, root `package.json`.

## Goal

Browser client for host protocol v1 (ADR 0019 D4). `useGuiSession()` connects,
lists no secrets, holds `sessionId`, thought/answer buffers, connection state,
and `prompt` / `cancel`. Keep the export names in the stub.

## Outcome

`gui/src/session/` now owns a real WebSocket client for `/v1/session`.

- `protocol.ts` — URL resolution, the D4 client encoder, and a strict parser
  for the five D4 server frames. `encodeClientMessage` writes only `type`,
  `requestId`, `sessionId`, `text`, `model`, so no header, credential, or env
  value can reach the wire. Unknown server frame types are ignored so the host
  can add frames later; malformed frames raise `GuiHostProtocolError`.
- `gui-session-client.ts` — `createGuiSessionClient()`, a framework-free store
  with `subscribe` / `getSnapshot`. It owns the socket, the `session/new`
  handshake, separate `thought` and `answer` buffers, `status`, `error`, and
  one in-flight prompt at a time. A generation counter discards events from a
  superseded socket, so reconnecting after an error is safe.
- `use-gui-session.ts` — `useGuiSession()` keeps one client per mount and
  re-renders through `useSyncExternalStore`.
- `types.ts` — widened additively. Every member the stub published is
  unchanged, so `gui/src/app.tsx`, `chat/`, `composer/` and `settings/`
  compile untouched.

Thought and answer land in separate buffers and are keyed by `sessionId`, so a
frame for another session cannot contaminate either buffer. A new prompt clears
both buffers before the first frame arrives.

The hook does not connect on mount. `SettingsPane` offers an explicit Connect
action while `status` is `idle` or `error`, which is the merged A008-0037
design; auto-connecting would remove that button and would show a permanent
error when the GUI host is not running.

## Published `GuiSession` shape

```ts
export type GuiSessionStatus = "idle" | "connecting" | "ready" | "error";

export interface GuiSessionState {
  readonly status: GuiSessionStatus;
  readonly sessionId: string | undefined;
  readonly model: string;
  readonly thought: string;
  readonly answer: string;
  readonly error: string | undefined;
}

export interface GuiSession extends GuiSessionState {
  connect(): Promise<void>;
  prompt(text: string): Promise<void>;
  cancel(): Promise<void>;
}
```

Structurally identical to the stub. `GuiSessionStatus` keeps exactly four
members because `gui/src/settings/settings-view.ts` builds a
`Record<GuiSession["status"], string>` over them.

## Verification

Working directory: `C:\code\A008-workers\A008-worker02`. Node v24.14.1.

- `node --experimental-strip-types --import ./gui/src/composer/test-loader.mjs --test ./gui/src/session/gui-session-client.test.ts`
  — 21/21 pass, 0 fail
- `npm --prefix gui run typecheck` — exit 0
- `npm --prefix gui run build` — exit 0
- `npm run typecheck` (root) — exit 0
- `npm test` (root) — 218/218 pass, 0 fail
- `grep -ri "NVIDIA_API_KEY" gui/src/session/` — no match
- Sibling GUI suites still green: composer 11/11, terminal 9/9,
  settings-view checks exit 0
- `git diff --check` — clean

Full command output is in `docs/handoffs/A008-0033.md`.

## Gates

- [x] Unit tests in `gui/` that fake a WebSocket, covering connect,
      `session/new/ok`, streaming thought and answer into separate buffers,
      `prompt/ok`, `cancel`, and a server `error` frame
- [x] The tests genuinely execute, reusing the A008-0035 `node --test` runner
- [x] No `NVIDIA_API_KEY` in client source
- [x] `npm --prefix gui run typecheck` clean for the whole GUI tree
- [x] Root `npm run typecheck` and `npm test` still green
- [x] Restore CURRENT_TASK template, handoff, PR, do not merge
