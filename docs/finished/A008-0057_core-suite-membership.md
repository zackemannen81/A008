# Task A008-0057 — Core suite membership check

Status: Complete
Owner: Operator
Parent: None
Created: 2026-09-04
Completed: 2026-09-04
Branch: `claude/A008-0057-suite-membership`

## Why

`test:core` names every core test file by hand on one line of `package.json`.
A008-0040 found two that had fallen out — `evidence.test.ts` and
`state-history.test.ts`, twenty cases — and had therefore never run. Both passed
the moment they were executed, which is the whole problem: nothing broke, the
suite reported a smaller number, and there was no reason to look.

A008-0056 made the case immediate rather than historical. Adding
`document-extraction.test.ts` meant hand-editing that line again, and the only
thing standing between a forgotten edit and thirty silently unrun cases was
remembering.

## The option taken, and the two not taken

`docs/backlog/discovery-based-core-suite.md` weighed three fixes. This is its
option 3.

Globbing `dist/test/**/*.test.js` — options 1 and 2 — was rejected on the ground
the backlog item already identified: `npm run build` does not clean `dist/`. A
glob would keep running compiled JavaScript whose TypeScript source had been
deleted or renamed, so a removed test could go on running and go on passing.
That is a worse failure than the one being fixed, because a green result that
corresponds to no source is actively misleading.

Option 1 fixes it by cleaning `dist/` on every build, which slows every build
and discards incremental output to solve a problem that appears once a month.
Option 2 fixes it with a script that maps sources to compiled paths, which
removes the toil but makes `test:core` indirect — a reader can no longer see
what runs.

Option 3 keeps the list, keeps `test:core` a command a person can read and a CI
can copy, and keeps a stale artifact unreachable because nothing names it. It
does not remove the maintenance. It removes the silence, which was the defect.

## What it checks

`test/core-suite-membership.test.ts` reads the `test:core` script out of
`package.json`, walks `test/**/*.test.ts`, and asserts four things:

- every source file appears in the list, naming any that do not;
- every entry has a TypeScript source, so a renamed file fails with the reason
  rather than with a module-resolution error;
- no file is named twice;
- the check itself is both a member of the list and reachable by name.

## The bootstrap hole, and how it is closed

A membership check that runs only as a member of the list it checks can be
disabled by the exact edit it exists to catch: delete its entry, and nothing
notices that nothing is noticing.

So it runs twice. It is in `test:core` like any other file, and `npm test` also
invokes it by name through a `test:membership` step. Removing its entry from the
list leaves the named step running, and the check then fails twice over — once
because a test file is unlisted, once because the arrangement it depends on is
gone. The fourth case asserts that arrangement explicitly, so quietly dropping
the `test:membership` script also fails.

## Verification

`npm test`: 356 core, 4 membership, 75 GUI, 0 fail, 0 skipped.

Six mutations to `package.json`, each applied alone and reverted:

| Mutation | Caught by |
| --- | --- |
| A008-0040's actual defect — `evidence.test.js` removed from the list | every core test file is named by `test:core` |
| a newly added file left unlisted | every core test file is named by `test:core` |
| an entry whose source was renamed away | `test:core` names nothing that no longer has a source |
| the same file listed twice | `test:core` names no file twice |
| the check's own entry removed | both the membership case and the self case |
| the `test:membership` script removed | the self case |

The first is the one that matters: it reproduces the original failure exactly,
and where the suite once reported a smaller count and passed, it now fails
naming the file.

## What this does not do

The list is still maintained by hand. Adding a test file still means editing
`package.json`; the difference is that forgetting now fails the build instead of
shrinking a number nobody reads. If that maintenance ever becomes the actual
problem, option 2 is still available and the backlog item records what it would
have to solve.
