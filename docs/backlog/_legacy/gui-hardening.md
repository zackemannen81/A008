# GUI hardening follow-ups

Status: Partially closed
Source: A008-0030 wave 1 (ADR 0019)
Recorded: 2026-09-02

In-scope work that was deliberately not absorbed into A008-0030 or any of its
frozen children. None of these blocks the product path proved in
[`../evidence/A008-0030_gui-runtime-proof.md`](../evidence/A008-0030_gui-runtime-proof.md).

## 1. Release ACP sessions when a renderer disconnects — CLOSED

The GUI host does not close its ACP session when the WebSocket goes away, so a
long-lived host accumulates session state. Bounded for local single-user use.
An owner is required before any shared or long-running deployment. Needs a
session-close path in the SDK usage, or an explicit host-side reaper.

Owning module: `src/gui-host/`.

**Outcome (A008-0038, merged PR #13).** Closed by implementing ACP
`session/close` rather than a reaper. The SDK already carried the method; A008
had never implemented it. The host now releases a closing socket's sessions.
Residual, moved to the known-gaps list in `docs/CURRENT_STATUS.md`: release is
disconnect-driven only, so a socket that never closes cleanly still holds its
sessions until the process exits.

## 2. One command for the GUI module tests — CLOSED

GUI unit tests run today through two `node --experimental-strip-types` loaders,
one under `gui/src/composer/` and one under `gui/src/chat/`, invoked by hand.
The root `npm test` does not reach them, so a GUI regression can land green.
They should be reachable from a single script and from whatever CI is
introduced.

This crosses `gui/package.json` and every `gui/src/` module, so it needs a task
that owns more than one module directory, or an operator-owned slice.

**Outcome (A008-0039, merged PR #14).** Closed. `gui/test/` holds one shared
runner, `npm --prefix gui run test` discovers `gui/src/**/*.test.ts` by glob,
and root `npm test` runs `test:core && test:gui`, so the default command is the
full gate. Verified by deliberate breakage (root exit 1) and by a throwaway
test file that ran with no script edit. Still open: there is no CI, so nothing
enforces that the gate is run before a merge.

## 3. Put a `messages` array on `GuiSession`

`gui/src/chat/capture-prompt.ts` observes user text by temporarily replacing
`session.prompt` on the shared session object, because host protocol v1 carries
buffers but no committed message list. It restores on unmount and degrades
safely against a frozen object, but it is a shim around a contract gap.

`buildChatTranscript` already prefers `session.messages` when present, so the
chat module needs no change once the session module publishes one. Owning
modules: `gui/src/session/` first, then the shim deletion in `gui/src/chat/`.

## 4. Consolidate the duplicate `node:test` ambient declarations — CLOSED

`gui/src/chat/node-test-shims.d.ts` and `gui/src/composer/node-test.d.ts` both
declare `node:test` and `node:assert/strict`. They coexist only because
`gui/tsconfig.json` sets `skipLibCheck: true`. Adding `@types/node` to the GUI
package, or disabling `skipLibCheck`, will collide until they are merged into
one shared declaration.

Pairs naturally with item 2.

**Outcome (A008-0039, merged PR #14).** Closed, but not as written. All three
declaration files turned out to be dead: deleting them left the GUI typecheck
green, because TypeScript walks up from `gui/` and resolved `node:test` from
the root package's `@types/node`. So the GUI typecheck silently depended on a
sibling package's devDependency, and full Node typings were in scope for
renderer code — `gui/src/app.tsx` could have imported `node:child_process` and
compiled. `gui/tsconfig.json` now sets `"types": []` and includes `test/`, so
the one remaining declaration in `gui/test/node-test-env.d.ts` is real and the
boundary those shims were written to protect actually exists. `skipLibCheck` is
unchanged. Residual: `node:fs`, `node:path`, and `node:url` stay declared
program-wide for one session test that imports them.

## 5. Decide the redaction trade for assistant text

Host wire redaction strips the literal tokens `NVIDIA_API_KEY` and
`authorization` from assistant text as well as from credential values, so an
answer that legitimately discusses those names renders as `[redacted]`. That is
the intended ADR 0019 D6 behavior and is correct while the credential boundary
is the priority. If GUI users need to discuss provider configuration, the rule
needs a narrower match rather than a weaker one.

Owning module: `src/gui-host/redact.ts`. Any change here is a security decision
and needs its own ADR amendment, not a quiet edit.
