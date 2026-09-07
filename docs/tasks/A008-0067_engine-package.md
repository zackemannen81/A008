# A008-0067 — Engine distribution with bundled panels and real tools

Task ID: A008-0067
Parent Task: None
Status: In Progress
Owner: Codex (operator)
Created: 2026-09-07
Last updated: 2026-09-07
Charter frozen at: 2026-09-07 after main allocation 0737b4a

## Task Summary

The owner approved distributing A008 as a complete engine used by the external
Felix client, retaining the existing A008 views in an engine panel. The preceding
tool request remains part of this outcome. The optional user coding prompt is
reference data; it is neither executable authority nor a bundled default.

## Task Charter

### Goal

Run the complete A008 capability set through a distributable engine that the
external client can discover, start, inspect, use and stop.

### Primary Deliverable

An engine package and a bounded generic client panel adapter, backed by an
actual shared project/session runtime and a typed model/tool/result loop.

### In Scope

- Reuse CLI, ACP, provider, memory, ingest, parameters and existing GUI views.
- Engine lifecycle and discoverability; project-aware sessions, one runtime
  owner per project, panel attachment to the actual external chat session.
- Bundle compiled GUI, runtime, manifest, production dependencies and runbook;
  validate an extracted package outside the repository.
- Generic engine panel capability in the external client; keep its source
  independent and avoid copying either application's implementation.
- Typed provider tool calls and tool-result continuation with cancellation,
  editable bounds and explicit execution approval; accept approved shared MCP
  resources using existing client policy.
- Shared streamed activity and truthful busy/history/model state across clients.
- Update owning docs, contract/ADR, evidence, archive and handoff.

### Out of Scope

- Hardcoding or automatically adopting the owner's coding prompt.
- New memory mutation semantics or replacing Felix's file/editor/workbench.
- Live/paid provider calls, push, publication, installer deployment or merging.
- Claiming installed Windows product proof without performing that gate.

### Definition of Done

- Felix's client discovers the extracted engine and can open its bundled panel.
- Native chat and panel operate on the same session; project isolation, model
  settings, durable memory and global instructions survive the intended lifecycle.
- An isolated workspace command truly executes after approval; its result reaches
  the next provider invocation. Denial/cancel/timeout and invalid calls do not
  become successful actions.
- Current A008 surfaces are included and work from the package, including upload.
- Full required root/client checks, synthetic integration and browser proof pass.
- Source, runtime user data and credentials remain separated; docs/closure complete.

### Minimum Verification Gates

- [ ] Root and GUI typecheck/build and full npm test.
- [ ] External client typecheck, tests and build plus adapter contract tests.
- [ ] Actual extracted-package discovery/start/session/panel/stop proof.
- [ ] Fake provider to real isolated tool execution and tool-result continuation.
- [ ] Project/session isolation, cross-surface state, cancellation and permissions.
- [ ] Desktop browser panel/settings/memory/upload proof, no paid provider call.
- [ ] Docs links/fences, secret boundary, git diff --check, archive and handoff.

## Decisions and Notes

- User selected retaining A008 views inside a panel, not rebuilding those views.
- A008 is canonical project authority. External frontend is a downstream client;
  its own repository workflow governs changes there, not A008 provenance.
- Source baselines: A008 06c7d2b; external client a0fcb06 (origin/main matched).
- No subagents; no copying third-party source. External changes are a separate
  local branch and commit. No push or release authority is inferred.
- A008-0066 implementation was owner-merged; its unfinished evidence/docs closure
  is recorded honestly in docs/paused and is resumed before final handoff.

## Checklist

- [x] Read authority and inspected both integration boundaries.
- [x] Claim on main; record frozen scope and lifecycle decision.
- [ ] Implement engine composition and session-bound panels.
- [ ] Implement model tools and approved execution.
- [ ] Integrate generic panels/permissions into the external client.
- [ ] Package, test, verify surfaces and complete documentation.

## Charter Amendment Log

- None.

## Verification

Pending implementation.

## Handoff and Follow-ups

No live provider calls or publication authorized.

