# Discovery-based core test suite

Status: Open
Source: A008-0040
Recorded: 2026-09-02

## Context

`test:core` names all 43 core test files by hand in `package.json`. A008-0040
found two that had fallen out of that list and had therefore never run:
`test/knowledge-model/evidence.test.ts` and
`test/knowledge-model/state-history.test.ts`, 20 cases between them. Both passed
once executed, so nothing was broken — but nothing had been checking either.

This is the same defect class A008-0039 closed on the GUI side, where the fix
was glob discovery. The core half was left as-is because it runs against
compiled output, which raises a question the GUI half does not have.

## Outcome sought

Adding `test/**/*.test.ts` runs it, with no `package.json` edit.

## Why it is not a straight copy of A008-0039

The GUI suite runs TypeScript sources directly under
`node --experimental-strip-types`, so a glob over `gui/src/**/*.test.ts` can
only match files that exist. `test:core` runs `dist/test/**/*.test.js`, and
`npm run build` does not clean `dist/`. A glob there would also match compiled
output whose TypeScript source was deleted or renamed, so a removed test could
keep running — and keep passing — against stale JavaScript.

That is a worse failure than the one being fixed: a test that runs but no longer
corresponds to any source is actively misleading.

## Options

1. Clean `dist/` as part of `build`, then glob `dist/test/**/*.test.js`. Simple,
   but slows every build and discards incremental output.
2. Glob the TypeScript sources and map each to its `dist` path, failing loudly
   if a compiled file is missing. Keeps the build fast; needs a small script.
3. Keep the explicit list and add a check that every `test/**/*.test.ts` appears
   in it. Cheapest, and it fails on the real condition — a file being forgotten
   — rather than changing how tests are run at all.

Option 3 is the smallest change that removes the defect class, and it is worth
weighing first. Options 1 and 2 are worth it only if there is a separate reason
to stop maintaining the list.

## Dependencies

None. Any of the three can be done independently.

## Suggested verification

Delete a test file's entry (option 3) or its source (options 1 and 2) and
confirm the command fails rather than silently reporting a smaller count.
