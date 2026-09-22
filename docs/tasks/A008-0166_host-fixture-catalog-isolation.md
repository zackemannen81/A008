# A008-0166 — Host fixture catalog isolation

Task ID: A008-0166
Parent Task: A008-0160
Status: Ready
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
