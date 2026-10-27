# Current Task

Task ID: A008-0217
Parent Task: None
Status: Complete
Owner: Codex (operator/implementer)
Created: 2026-10-27
Charter frozen at: 2026-10-27

## Task Charter
### Goal
Make the existing direct OpenAI GPT-6 Luna selection send its provider model name to OpenAI.
### Primary Deliverable
Correct embedded ACME wire mapping with regression coverage.
### In Scope
Explicit internal-to-wire model mapping, retained provider routing, matching request measurement, owning documentation.
### Out of Scope
Kie reliability, retries, credential changes, automatic migration of saved model choices, external publication.
### Definition of Done
OpenAI Luna sends gpt-6-luna to OpenAI with OpenAI credentials in streaming and nonstreaming requests; Kie keeps its explicit route. Exact measurement matches captured bytes. Build and relevant tests pass; archive/handoff supplied.
### Necessity Gate
Contract: docs/PROJECT_BRIEF.md at 0efa9928c38e146dfe1a4e85ca546654bdc324ce
| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Model mapping and routing | PC-LF-04; published ACME executes models, A008 composes selections | Direct OpenAI receives the provider model ID; otherwise internal prefix causes rejection | Map this one alias and retain original selection for routing and measurement | Installed ACME fake HTTP assertions for URL, auth, model, measured bytes, both streaming modes |
### Minimum Verification Gates
- Root build and typecheck.
- Embedded ACME and continuation measurement regression tests.
- Final necessity/diff review and current-task template restoration.
### Verification Budget
Local fixtures only; no live dispatch, cost/calls/token limits zero. No live provider acceptance claim.
## Checklist
- [x] Diagnose outgoing internal ID and allocate identity on local main.
- [x] Implement bounded mapping and regression tests.
- [x] Verify, document, archive and hand off.
## Notes
Owner authorized direct OpenAI correction. No push/merge authorized. Existing working branch retained for local delivery. Ready charter frozen before implementation. No architecture or memory policy change.

## Verification

- Root build PASS; root typecheck PASS.
- Installed ACME HTTP fixtures and continuation-pressure/model-registry tests: 32/32 PASS.
- Four alias regressions cover OpenAI/Kie, streaming/nonstreaming, exact URL/auth/model and measured bytes. No actual credentials or network used.
- Live calls: 0; spend: 0 SEK. Provider acceptance and existing user's session not exercised.
- Necessity review: all source changes repair PC-LF-04 composition; no retry, provider fallback or semantic policy added.
- Owning SYSTEMDOC and CURRENT_STATUS updated. FILESTRUCTURE unchanged; no new architecture decision needed.

## Handoff

Local implementation complete. Restart GUI host to load rebuilt code and select
OpenAI GPT-6 Luna. Existing Kie selections are not automatically migrated.
No push, merge, provider call or user-settings change performed.

