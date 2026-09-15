# A008-0113 — README current-state refresh

Task ID: A008-0113
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-15
Last updated: 2026-09-15
Charter frozen at: 2026-09-15; contract revision `28aec83`

## Outcome

`README.md` is rewritten as a current repository entry point instead of an early-project implementation diary. It now describes the shared engine/runtime, current providers, live semantic-memory path, standalone GUI, project creation/adoption, portable engine, ACP compatibility and the implemented V2 native-client surface.

The README records A008-0103 Stages 1–3 as Complete and Stage 4 as the next backend boundary. It distinguishes the existing V1 GUI resume behavior from the not-yet-implemented V2 Stage-4 reconnect/idempotency guarantees.

Current requirements and commands match `package.json`: Node >=22.13.0, root/GUI installs, provider keys, protocol verification, device grant/list/revoke and engine packaging.

## Necessity review

PC-01/04/05/06 and the observed A008-0103 progress require the repository entry point not to direct contributors or native-client work through obsolete provider/runtime/API claims. The change is documentation-only and delegates deep authority to CURRENT_STATUS, SYSTEMDOC, CLIENT_AUTH and CLIENT_API_V2 rather than duplicating it.

## Verification

- Reviewed README claims against `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/CLIENT_AUTH.md`, `docs/CLIENT_API_V2.md`, A008-0103 and `package.json`.
- Searched for stale early-project claims including one-model, NVIDIA-only and missing-V2 language; no matches remain.
- Checked 26 local Markdown links; zero unresolved targets.
- README contains one H1 and ends with a newline.
- `git diff --check` passed.
- Working implementation diff before closure contained only `README.md`; no source, schema or generated protocol artifact changed.
- Runtime/typecheck/test/build gates were not repeated: this task changes documentation only, and A008-0112's immediately preceding verified runtime state remains the referenced implementation baseline.
- No provider call, credential operation, deployment, publication or host restart was performed.
