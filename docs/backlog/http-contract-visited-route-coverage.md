# Repair stale HTTP and protocol contract fixtures

Status: Proposed
Observed: 2026-09-30 during A008-0201 verification

`test/http-contract.test.ts` passes parser and generated-reference checks but
its final real-host visited-route inventory fails: file, skills and workspace
routes present in the HTTP registry are not exercised by its request sequence.
Two protocol checks also fail: the V1 literal-route inventory omits GET/POST
`/v1/runtime-preferences`, and the V3 conversation fixture omits required
`workspaceId`. The tests, `packages/protocol/src/routes.ts`,
`packages/protocol/src/platform-v3.ts` and `src/gui-host/server.ts` are unchanged
from merged base `c4d3914` (verified with git diff).

The test and registry were not changed by A008-0201. This does not indicate a
failure in the new durable GUI activity wait; that path has a real-host test.

Outcome: exercise or explicitly account for all registered routes with meaningful
fixtures, preserving auth/error validation rather than deleting inventory entries.
Not active: unrelated to GUI message/streaming regression repair. Dependencies:
current route schemas and isolated filesystem/skill/workspace fixtures.
Suggested verification: run `node --test dist/test/http-contract.test.js dist/test/protocol-contract.test.js` after
build and confirm the entire visited-route inventory matches the registry.
