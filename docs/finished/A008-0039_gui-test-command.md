# Task A008-0039 — One command for the GUI module tests

Status: Complete
Owner: operator-delegated
Parent: A008-0030 follow-up
Created: 2026-09-02
Completed: 2026-09-02
Branch: `claude/A008-0039-gui-test-command`
Base revision: aad3f21

Closed items 2 and 4 of `docs/backlog/gui-hardening.md`.

## Goal

One command runs every GUI module test, discovers new test files without being
edited, and fails the build when a GUI test fails.

## What was wrong

The 63 GUI tests ran only when a human typed one of two long invocations, one
per module loader. Root `npm test` could not see them, so a GUI regression
landed green. That is how A008-0034's original chat gate — a test that asserted
on the transcript model while its archive claimed it proved the rendered DOM
contract — reached human review instead of failing a build.

## Change

- `gui/test/` holds one shared runner for the whole tree: `loader.mjs`,
  `resolve.mjs`, and `node-test-env.d.ts`. The resolver is the former
  `gui/src/chat` one, which was already a strict superset of the composer
  version: `.ts`/`.tsx` resolution, `.tsx` compiled with the esbuild Vite
  already installs, and CSS side-effect imports stubbed.
- Deleted `gui/src/chat/test-loader.mjs`, `gui/src/chat/test-resolve.mjs`,
  `gui/src/composer/test-loader.mjs`, `gui/src/composer/test-resolve.mjs`,
  `gui/src/chat/node-test-shims.d.ts`, `gui/src/composer/node-test.d.ts`, and
  `gui/src/session/node-ambient.d.ts`.
- `gui/package.json` gains `test`, which runs
  `node --experimental-strip-types --import ./test/loader.mjs --test "src/**/*.test.ts"`.
  Discovery is by glob; no file list is maintained.
- Root `package.json` splits the old `test` into `test:core` (unchanged
  content) and `test:gui`, and `test` now runs `test:core && test:gui`. The
  command everyone already types is the full gate, which is the point of the
  task; a separate opt-in command would not have fixed anything.

## The finding that changed the shape of item 4

The three ambient declaration files were never load-bearing. Deleting all three
left `npm --prefix gui run typecheck` green, because TypeScript walks up from
`gui/` and resolves `node:test` from the **root** package's
`node_modules/@types/node`. `--listFiles` confirms the root copy is in the
program and the GUI's own declaration file was not.

Two consequences followed:

1. The GUI package's typecheck silently depended on a sibling package's
   devDependency. A standalone `gui/` install would not have typechecked.
2. Full Node typings were in scope for renderer code, so `gui/src/app.tsx`
   could have imported `node:child_process` and typechecked. The boundary the
   three shim files were written to protect had never actually existed.

`gui/tsconfig.json` now sets `"types": []`, which stops the automatic pickup,
and includes `test` so the one declaration is really in the program. Node
built-ins now resolve for GUI code only through that declaration.

Cutting off the real typings then exposed 46 downstream errors, all narrowing:
the real `node:assert/strict` typings declare `ok` as `asserts value` and
`equal` as `asserts actual is T`, and `gui/src/chat` and `gui/src/session` rely
on both — including through an optional chain, where
`assert.equal(request?.type, "session/new")` is what makes `request`
non-optional on the next line. The shared declaration now mirrors those two
signatures faithfully. No test assertion and no module source was changed.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| GUI suite | `npm --prefix gui run test` | 63 pass, 0 fail, exit 0 |
| Full gate | `npm test` | 234 core + 63 GUI, 0 fail, exit 0 |
| GUI types | `npm --prefix gui run typecheck` | clean |
| GUI bundle | `npm --prefix gui run build` | built |
| Root types | `npm run typecheck` | clean |

63 matches the pre-change per-module counts exactly: composer, session,
terminal and settings totalled 34, chat totalled 29. Nothing was silently
skipped.

### Failure propagation

| State | `npm --prefix gui run test` | root `npm test` |
| --- | --- | --- |
| One GUI assertion deliberately broken | 57 pass, 6 fail, **exit 1** | **exit 1** |
| Reverted | 63 pass, 0 fail, exit 0 | exit 0 |

The root result is the one that matters: a GUI failure now fails the default
command.

### Discovery

A throwaway test was added at `gui/src/brand/throwaway-discovery.test.ts`, in a
module that has never had a test and is named in no script. The suite reported
64 passing without any script or runner edit. The file was deleted and the
suite returned to 63, with `git status` clean.

### Boundary check

Adding `import { spawn } from "node:child_process"` to `gui/src/app.tsx` now
fails typecheck with TS2307. Before this change it compiled.

## Out of scope and not done

- No test assertion and no module implementation file was changed.
- No test framework, bundler, or runtime dependency was added.
- No CI. Root `npm test` is the full gate, but nothing enforces that anyone
  runs it before a merge.
- `node:fs`, `node:path`, and `node:url` remain declared for the whole GUI
  program, because `gui/src/session/gui-session-client.test.ts` imports them and
  an ambient module declaration cannot be scoped to test files without a
  separate TypeScript project. Renderer code can therefore still reach those
  three; every other Node built-in is now blocked.
