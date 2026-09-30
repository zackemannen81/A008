# A008-0202 — Explicit MCP tool strictness

Task ID: A008-0202
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-30
Charter frozen at: 2026-09-30 after allocation on main

## Task Charter

### Goal
Use the owner-installed ACME 0.1.7 non-strict path for explicitly selected MCP
tools while retaining strict defaults and local validation before execution.

### Primary Deliverable
Persisted MCP strict settings propagated to ACME, visible in GUI, with execution
tests proving invalid arguments cannot reach the MCP server in either mode.

### In Scope
- Server strict default and tool-name overrides, additive catalog/protocol fields.
- Preserve policy across existing engine/ACP paths and MCP health fingerprints.
- Strict defaults, explicit wire value, original-schema validation in both modes;
  null omission normalization only for strict tools. Existing runtime containment remains.
- GUI setting/display, dependency integration, tests and owning documentation.

### Out of Scope
- Changes to C:\code\acme or DesktopCommanderMCP; automatic non-strict fallback.
- New retry framework, structured final-output policy, arbitrary provider guarantees.
- Publication, push, deployment or changes to saved user settings.

### Definition of Done
- Old settings stay strict; per-tool override wins over server default.
- Explicit policy survives save/load and execution mapping to ACME 0.1.7.
- Invalid schema arguments produce a failed result before approval/execution;
  non-strict does not use strict null normalization. Existing call budgets apply.
- GUI exposes server choice and shows overrides; health reflects policy changes.
- Relevant tests/builds pass, docs/archive/handoff and template restoration complete.

### Necessity Gate
Contract: docs/PROJECT_BRIEF.md; revision eb30c4b.

| Change | Clause and accepted constraint | Observable need / omission | Smallest approach | Verification |
| --- | --- | --- | --- | --- |
| MCP strict policy | PC-LF-01/04; owner explicitly requests ACME 0.1.7 integration | Otherwise installed non-strict cannot be selected for incompatible tools | Optional server boolean and original-tool-name overrides through existing catalog/ACP metadata | Roundtrip, precedence, ACME wire tests |
| Local validation | PC-LF-04; A008 owns tools and permissions | Best-effort provider arguments must not reach execution unchecked | Retain original validator, only strict null normalization | Real MCP fixture negative effects and approval count |
| GUI/health/docs | PC-LF-09 and explicit policy visibility | Operator must select/see policy and stale sessions | Existing MCP editor/status and fingerprint | GUI suite, fingerprint and docs review |

### Minimum Verification Gates
- [x] Root/GUI builds and relevant MCP/catalog/provider tests.
- [x] Protocol/client compatibility including generated schemas.
- [x] Original-schema rejection and strict/non-strict wire proof with local fixtures.
- [x] Necessity review, documentation, immutable archive, current-task template.

### Verification Budget
Local fixtures and installed-package wire verification only. 0 live calls / 0 SEK.
No external provider acceptance claim. Policy: TASK_WORKFLOW at eb30c4b.

## Checklist
- [x] Inspect authority, allocate ID, review and freeze.
- [x] Implement settings, propagation, validation and GUI.
- [x] Verify, document and finalize.

## Decisions and Notes
Owner's package.json/package-lock.json upgrade is included. Existing validation
and bounded tool loop are reused. ACP carries A008 policy in namespaced _meta,
not undeclared ACP wire properties. No secrets or actual user catalog edits.

## Verification
Root build/typecheck, GUI production build/typecheck PASS. GUI 222/222 PASS.
Primary MCP/provider/catalog tests 82/82 PASS; expanded ACP/engine/parity suite
107/108 with one unrelated semantic-model fixture failure documented in backlog.
Packed protocol and client independent consumers PASS; generated artifact and
reference checks 3/3 PASS. Commands and limits are in the handoff.

Necessity review: production changes enable explicit tool policy under PC-LF-04,
validate non-strict execution and make saved/stale policy observable. Direct
compatible adapter upgrade to 0.1.7 is required because it is separately imported;
upgrading only acme-engine left that path at 0.1.4. No execution scheduler, new
retry policy, native permission change or semantic policy change added.
No live-provider/browser visual verification; local fixtures, 0 calls / 0 SEK.

## Documentation Updates
SYSTEMDOC, CURRENT_STATUS, ADR/index, FILESTRUCTURE, JOURNAL, handoff/archive.

## Handoff and Follow-ups
[Handoff](../handoffs/A008-0202.md), [archive](../finished/A008-0202_mcp-strictness.md).
[Semantic fixture follow-up](../backlog/semantic-model-parity-fixture.md).
Complete locally; no push/merge or changes in the ACME checkout.
