# A008-0168 — Platform admin CLI

Task ID: A008-0168
Parent Task: A008-0160
Status: Complete
Owner: Grok (worker)
Created: 2026-09-22
Charter frozen at: 2026-09-22 after claim 36be3af
Branch: codex/a008-0168-platform-admin-cli
Clone: assigned by the operator outside the canonical tree

## Goal and primary deliverable

Provide a local CLI that inspects platform availability, lists conversations,
reads one run and cancels one run through the existing V3 client.

## Accepted dependencies

A008-0164 and A008-0165 are merged. Read `docs/platform/BACKEND.md`,
`docs/platform/CLIENT.md` and this charter. Use `createPlatformV3Client`.
Device credentials stay in the existing device registry. Do not add HTTP routes.

## Write scope

- New `src/platform/admin-cli.ts`.
- One root `package.json` script, plus registration of the new test in the
  existing `test:core` list only.
- `test/platform-admin-cli.test.ts`.
- `docs/platform/ADMIN.md`, this task record, `docs/CURRENT_TASK.md` while
  working, `docs/finished/A008-0168_platform-admin-cli.md` and
  `docs/handoffs/A008-0168.md`.
- No GUI, `src/gui-host/server.ts`, coordinator, store semantics, protocol,
  client package, lockfiles or migration.

## Frozen behavior

- Commands are `info`, `list-conversations --project`, `get-run --run` and
  `cancel-run --run --expected-revision`.
- Origin comes from `--origin` or `A008_PLATFORM_ORIGIN`. The device token comes
  only from `A008_DEVICE_TOKEN`. No credential flag, URL credential, prompt
  payload or `.env.local` read.
- `info` works without a token and prints availability and the capability names
  returned by the host. It does not print configuration.
- The other commands send the bearer once through the SDK. They do not retry.
  `cancel-run` performs one cancel request. There is no reconcile, import,
  grant, revoke or backup command.
- Unavailable platform and unauthenticated calls exit non-zero with the SDK
  error code. They do not open a database.
- Tests mint a device credential through the existing device-grant owner used
  by the host. They do not create a second credential store.

## Necessity Gate

Contract: `docs/PROJECT_BRIEF.md` PC-07, refined by platform spec section 18
and ADR 0048 D7.
Contract revision: `bda4d6dc1a4f4bb1146f210f9b07db4c97d998cf`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Inspect and cancel CLI | PC-07 operations need a minimum admin tool before a console; section 18 allows CLI before Admin Console | An operator can see and cancel a local run without a browser; without it only ad hoc HTTP exists | Four commands over the merged SDK | Real-host CLI test against a temporary platform file |

## Gates

Typecheck, build, the new CLI test and full `npm test` pass. The test uses a
real host, temporary platform file and loopback provider. Prove `info` when
unavailable, authenticated list/get, one cancel, and that a second cancel or a
lost response is not retried by the CLI. `git diff --check` passes. Budget is
0 SEK and 0 live provider calls.

Restore `docs/CURRENT_TASK.md` from the template before push. Archive, commit,
push and open a PR. Do not merge. Put canonical status deltas in the handoff.

## Verification

Status: Complete. Fixture/local only. 0 live product-provider calls. 0 SEK.
No `.env.local` was read. The CLI opens no platform database.

- `npm ci` at the repo root passed (244 packages). `npm ci --prefix gui` passed (70 packages). Lockfiles were not changed.
- `npm run typecheck` passed.
- `npm run build` passed, including `build:client` inside `npm test`.
- `node --test --test-force-exit dist/test/platform-admin-cli.test.js` — 2 passed, 0 failed.
- `npm test` — `test:core` 758 passed, 0 failed; `test:membership` 4 passed, 0 failed; `test:gui` 192 passed, 0 failed.
- `git diff --check` passed.
- `docs/CURRENT_TASK.md` matches `docs/template_CURRENT_TASK.md` byte for byte.

The real-host test started the GUI host on a temporary platform file outside the repository and a loopback session-control provider. `info` without a platform path printed `available: false` and `capabilities: []`, sent no bearer, and left no `platform.sqlite`. Listing that host exited `NOT_FOUND` after one request. With the platform opted in, a missing token exited `UNAUTHENTICATED` after one request. An authenticated `list-conversations` and `get-run` saw the minted device bearer once. One `cancel-run` sent one `POST /cancel` and printed `cancel_requested`. A second `cancel-run` invocation sent exactly one more `POST /cancel` and did not retry. A proxy that delivered one cancel and then dropped the response made the CLI exit `TRANSPORT_ERROR` after that single POST; the host had already applied it (`cancel_requested` or `cancelled`). Each `WAIT-TURN` prompt was sent to the loopback provider once. `.env.local`, URL userinfo, query credentials, and grant/revoke/backup/import/reconcile made no request.
