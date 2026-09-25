# A008-0166 — Host fixture catalog isolation

Task ID: A008-0166
Parent Task: A008-0160
Status: Complete
Owner: Codex GPT-5.6 Terra (worker)
Created: 2026-09-22
Charter frozen at: 2026-09-22 after allocation ca84075
Branch: codex/a008-0166-host-fixture-isolation
Clone: C:/code/A008-workers/A008-0166-host-fixture-isolation

## Goal and primary deliverable

Prevent isolated local host test fixtures from loading the user's default model/MCP
catalog. Restore reproducible independent V2 SDK host verification.

## Observed need / Necessity Gate

PC-05 explicit authority and PC-01 shared-owner regression checks; program0160.
On canonical efa0fae, A008-0149-client-v2-host fails at prompt with RUNTIME_FAILED;
bounded temporary diagnostics show McpError Connection closed. The fixture calls
isolatedMemoryEnv but omits A008_CATALOG_PATH, so configuredMcpServers reads the
normal user catalog. The same test passes 1/1 when only that path is set to a
temporary catalog. Do not inspect user catalog content, credentials or processes.
Omission makes verification environment-dependent and can launch real MCP tools.
Smallest fix: isolate the existing helper's catalog path, preserving explicit
overrides. No changes to product behavior or model/provider adapters.

## Frozen scope

- test/helpers.ts: isolatedMemoryEnv supplies a non-existing temp catalog path
  by default, before explicit overrides. Verify any other host config touched
  by this exact fixture remains isolated; report rather than broadening scope.
- test/A008-0149-client-v2-host.test.ts: bounded fixture setup/assertion only if
  needed to exercise the isolated catalog; no new framework or production hooks.
- this task/current-task, unique archive docs/finished/A008-0166_host-fixture-catalog-isolation.md,
  handoff docs/handoffs/A008-0166.md.
- Global docs/indexes belong to operator integration. No package/source/SDK or
  other worker paths, dependencies, lockfiles or live provider calls.

## Gates and completion

Read required repository authority with bounded relevant context. Build/typecheck;
run exact V2 real-host SDK test and existing gui-host/v2-auth tests using temporary
configuration; full npm test verifies shared-helper regressions. Preserve caller
overrides. Do not launch normal user-configured MCP processes. All provider
interaction is deterministic loopback, 0 SEK / 0 live provider calls.
Restore CURRENT_TASK exactly, archive, commit/push/open/attach PR; never merge.
Report base/head/PR, commands/results, known limitations and proposed canonical
documentation delta. Worker success alone is not the operator acceptance gate.
No subdelegation. No architecture decision required for fixture isolation.

## Verification

Implemented in `C:\code\A008-workers\A008-0166-host-fixture-isolation-grok` on
branch `codex/a008-0166-host-fixture-isolation` from base
`e68e0e6a941ec62e9b57b515e3a7064117dedc8c`. The older occupied clone
`A008-0166-host-fixture-isolation` was not read or modified.

`isolatedMemoryEnv` now sets `A008_CATALOG_PATH` to `catalog.json` inside its
new temporary directory before `...overrides`. The file is not created.
`loadUserCatalog` returns the empty catalog for a missing path, so
`configuredMcpServers` does not read `~/.a008/catalog.json`. An explicit
override still replaces the default. The V2 host test asserts that missing
temporary path and that an override wins, then prompts through the existing
loopback session-control provider.

Commands, all without `--env-file .env.local`:

- `npm ci` — exit 0.
- `npm run typecheck` — exit 0.
- `npm run build:client` — exit 0.
- `npm run build` — exit 0.
- `node --test dist/test/A008-0149-client-v2-host.test.js` — 2 passed, 0 failed.
- `node --test dist/test/gui-host.test.js` — 44 passed, 0 failed.
- `node --test dist/test/v2-auth.test.js` — 16 passed, 0 failed.
- `npm test` before `gui/node_modules` existed — core 745 passed / 0 failed,
  membership 4 passed / 0 failed, GUI 35 failed / 0 passed. Every GUI failure
  was `ERR_MODULE_NOT_FOUND` for `esbuild` from `gui/test/resolve.mjs`. That is
  missing GUI install state, not a helper regression. Root `npm ci` does not
  install `gui/`.
- `npm ci --prefix gui` — exit 0. Lockfile unchanged.
- `npm test` — exit 0. Core 745 passed / 0 failed, membership 4 passed / 0
  failed, GUI 192 passed / 0 failed. Total 941 passed, 0 failed, 0 skipped.

No live provider call. 0 SEK. Provider interaction in the V2 host test stayed
on the deterministic loopback session-control fixture.

`docs/CURRENT_TASK.md` was restored byte-for-byte from
`docs/template_CURRENT_TASK.md` before commit.

## Other host config touched by the V2 fixture

Not changed. The fixture already isolates settings (`A008_SETTINGS_PATH`),
memory SQLite, debug trace, devices, and projects. Its project uses
`useGlobalA008Memory: false`, so the V2 session sqlite path is `:memory:`.
`A008_SOURCE_STORE_PATH` stays unset, so source ingest stays off rather than
using a user store. The test still copies `process.env.PATH`; with the empty
temporary catalog, session construction passes no MCP servers.

`A008_SECRETS_PATH` remains unset. `startGuiHost` therefore resolves
`~/.a008/secrets.json`. `NVIDIA_API_KEY` is set, so the NVIDIA resolver returns
before reading that file. The KIE, OpenAI, OpenRouter, Groq, Gemini, and
OpenCode resolvers still call `loadProviderSecrets` when their environment keys
are absent. That can read the user secrets file during host startup. It does
not launch MCP. Broadening the helper to isolate secrets was out of scope.
