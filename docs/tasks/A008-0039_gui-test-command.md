# Task A008-0039 — One command for the GUI module tests

Status: Ready
Owner: operator-delegated
Parent: A008-0030 follow-up
Created: 2026-09-02
Charter frozen at: 2026-09-02
Branch: `claude/A008-0039-gui-test-command`
Clone: `C:\code\A008-workers\A008-0039_gui-test-command`

Activates items 2 and 4 of
[`../backlog/gui-hardening.md`](../backlog/gui-hardening.md).

## Task summary

The 63 GUI unit tests run today only when a human types one of two long
`node --experimental-strip-types` invocations, one using the loader in
`gui/src/composer/` and one using the loader in `gui/src/chat/`. The root
`npm test` cannot see them, so a GUI regression can land on `main` with a green
suite. That happened during A008-0030: a chat gate that asserted nothing was
caught by review, not by the test command.

## Goal

One command runs every GUI module test, discovers new test files without being
edited, and fails the build when a GUI test fails.

## Primary deliverable

A `test` script in `gui/package.json` that runs all GUI module tests, reachable
from the repository root.

## In scope

- One shared Node test loader and resolver for the whole GUI tree, replacing the
  duplicated pair. `gui/src/chat/test-resolve.mjs` is already a superset of
  `gui/src/composer/test-resolve.mjs`: it adds `.tsx` compilation through the
  esbuild that Vite already installs, and CSS side-effect stubbing. Promote one
  shared implementation to a stable path such as `gui/test/` and delete the
  duplicates; update the two modules that import them.
- `gui/package.json`: a `test` script that runs the GUI tests by discovery, not
  by a hand-maintained file list.
- Root `package.json`: make the GUI tests reachable from the root. Keep
  `npm test` meaningful for the core suite; add explicit wiring so one command
  covers both. State plainly in the handoff which command is now the full gate.
- Item 4 of the backlog: consolidate the duplicate `node:test` and
  `node:assert/strict` ambient declarations in `gui/src/chat/node-test-shims.d.ts`,
  `gui/src/composer/node-test.d.ts`, and `gui/src/session/node-ambient.d.ts`
  into one declaration, or remove the need for them.
- Moving a `*.test.ts` file only if the shared runner requires it. Prefer
  leaving tests beside their modules.

## Out of scope

- Any change to test assertions or to module implementation code. If a test
  fails under the new runner, report it; do not weaken the test to make the
  command green.
- `src/`, including `src/gui-host/`. A008-0038 owns `src/acp/` and
  `src/gui-host/` concurrently; do not edit either.
- Adding a test framework, a bundler for tests, or a new runtime dependency.
  `node --test` plus the esbuild Vite already installs is the boundary.
- CI configuration. There is no CI in this repository yet.
- Coverage thresholds, watch mode, and browser-based test execution.

## Definition of done

- One documented command runs all 63 existing GUI tests and reports them.
- Adding a new `gui/src/<module>/x.test.ts` requires no runner or script edit
  for it to run.
- A deliberately failing GUI test makes that command exit non-zero. Verify this
  by temporarily breaking one assertion, observing the failure, and reverting.
- Exactly one ambient declaration of `node:test` and `node:assert/strict`
  remains in the GUI tree.
- `gui/tsconfig.json` still typechecks with `skipLibCheck` unchanged.

## Minimum verification gates

- [ ] The new command reports 63 passing GUI tests, matching the current
      per-module counts: composer, session, terminal and settings total 34;
      chat totals 29.
- [ ] Failure propagation checked by deliberate breakage, then reverted, with
      both observed exit codes recorded in the handoff.
- [ ] Discovery checked by adding a temporary throwaway test file, observing it
      run, then deleting it.
- [ ] `npm --prefix gui run typecheck` clean.
- [ ] `npm --prefix gui run build` clean.
- [ ] Root `npm run typecheck` and `npm test` still green at 234 passing.

## References

- [`../backlog/gui-hardening.md`](../backlog/gui-hardening.md) items 2 and 4
- [`../adr/0019-a008-owned-gui.md`](../adr/0019-a008-owned-gui.md) D7 module
  ownership
- [`../FILESTRUCTURE.md`](../FILESTRUCTURE.md) product-paths section, which
  currently records that GUI tests do not run from the root

## Decisions and notes

- This task deliberately crosses module directories, which ADR 0019 D7
  otherwise forbids. The operator grants that exception for test plumbing only:
  loader files, ambient declaration files, and package scripts. Module
  implementation code and test assertions stay owned by their D7 tasks.
- `docs/CURRENT_STATUS.md` and `docs/FILESTRUCTURE.md` both state that the GUI
  tests are not reachable from a single repository command. Update both in the
  same change as the behavior.
