# A008-0113 — README current-state refresh

Task ID: A008-0113
Parent Task: None
Status: Ready
Owner: Codex (operator)
Created: 2026-09-15
Last updated: 2026-09-15
Charter frozen at: 2026-09-15; contract revision `28aec83`

## Task Summary

Refresh the repository README so a new contributor or client implementer sees the system that actually exists after A008-0112 instead of an early-project snapshot.

## Task Charter

### Goal

Make `README.md` an accurate, concise entry point to A008's current implemented capabilities, setup, client API status and known next boundary.

### Primary Deliverable

A rewritten `README.md` grounded in current owning docs, with no product-code or runtime-semantic changes.

### In Scope

- Current engine, GUI, CLI, ACP, provider, project and semantic-memory capabilities.
- Stage 1–3 client API status, V2 auth/session quick start and explicit Stage-4 limitations.
- Current install/test commands and provider-key requirements.
- Links to owning docs instead of duplicating deep implementation history.
### Out of Scope

- Product code, API behavior, provider calls, deployment, publication or service restart.
- Implementing Stage 4 recovery/idempotency or claiming later stages are complete.
- Rewriting deep technical authority already owned by SYSTEMDOC/CURRENT_STATUS/CLIENT_API_V2.

### Definition of Done

- README no longer contains known stale early-project claims.
- Setup, V1/V2 availability, project adoption, providers, memory and current limitations match owning docs.
- Local README links resolve and `git diff --check` passes.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `28aec83`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| README current-state repair | PC-01/04/05/06; A008-0103 observed progress; README is repository entry point | New contributors/native-client work would be guided by obsolete provider, runtime and V2 claims. | Rewrite README only, referencing existing authority for detail. | Compare claims against CURRENT_STATUS, CLIENT_AUTH, A008-0103 and package scripts; check local links/diff. |

### Minimum Verification Gates

- [ ] README factual review against current owning docs.
- [ ] Local Markdown file links resolve.
- [ ] `git diff --check` passes.
- [ ] No product source or generated protocol artifact changes.

## References

- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/CLIENT_AUTH.md`
- `docs/CLIENT_API_V2.md`
- `docs/tasks/A008-0103_stable-client-api-program.md`
- `package.json`
