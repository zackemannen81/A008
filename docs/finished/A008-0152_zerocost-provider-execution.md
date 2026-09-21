# A008-0152 — ZeroCostRadar provider execution support

Task ID: A008-0152
Parent Task: None
Status: Complete
Owner: ChatGPT (operator)
Created: 2026-09-21
Last updated: 2026-09-21
Charter frozen at: 1a9111cdfb9de35982078977a0e3c45521d74694

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/finished/A008-0151_zerocost-live-refresh-and-import.md`
- `docs/handoffs/A008-0151.md`
- `docs/adr/0019-a008-gui-host-and-thin-client.md`
- `docs/adr/0028-engine-distribution-and-client-panel-integration.md`
- `docs/adr/0034-product-contract-and-necessity-gate.md`

## Task Summary

A008-0151 exposes validated ZeroCostRadar routes and deliberately allows import
only when A008 already has truthful execution support. The current catalog
execution resolver contains an implicit `unknown provider -> nvidia` coercion.
That coercion is not a fallback: it can send a user-selected model to the wrong
provider and must be removed before additional Radar providers become addable.

This task makes execution authority explicit and adds the smallest host-owned
OpenAI-compatible provider route needed for current ZeroCostRadar
Chat-Completions providers. Discovery metadata never grants execution by itself.

## Task Charter

### Goal

Remove implicit provider coercion and make validated OpenAI-compatible
ZeroCostRadar Chat-Completions routes executable through explicit provider,
endpoint and credential ownership.

### Primary Deliverable

A model imported from a supported ZeroCostRadar provider retains an explicit
execution route and can execute through A008/embedded ACME without being
misrouted to NVIDIA; unsupported providers/API styles fail closed.

### In Scope

- Remove `unknown provider -> nvidia` from catalog/execution resolution.
- Extend user-model persistence with bounded execution-route metadata needed by
  imported ZeroCostRadar models.
- Support current OpenAI-compatible Chat Completions routes for:
  - OpenRouter
  - Groq
  - Google Gemini OpenAI compatibility
  - OpenCode free-compatible routes
- Keep NVIDIA, KIE and native OpenAI behavior unchanged.
- Reuse embedded ACME's existing compatible-provider substrate rather than
  duplicating one transport implementation per compatible provider.
- Add host-owned write-only credential support for provider keys that require or
  optionally use credentials.
- Preserve OpenCode route identity exactly: current Radar entries use the Zen
  API-key route and may require `OPENCODE_API_KEY`; the separate documented
  auth-free `/inference/openai/...` route must not be substituted implicitly.
- Make ZeroCostRadar Add eligibility derive from actual executable route support,
  not provider-name guesses.
- Preserve exact imported model id, provider, endpoint and API style.
- Fail closed for unsupported API styles, unknown providers, malformed endpoint
  metadata or missing required credentials.
- Keep direct/reference chat mode semantically aligned with embedded ACME where
  the same compatible route is supported.
- Add focused regressions for explicit provider resolution, credentials,
  persistence, import gating and request destination/auth.

### Out of Scope

- Automatic provider/model fallback or provider substitution.
- Automatic paid fallback, credit purchase, billing setup or plan upgrades.
- Importing arbitrary unvalidated user-provided base URLs.
- Generic arbitrary-provider UI configuration beyond validated Radar routes.
- Provider-native SDK integrations when the documented OpenAI-compatible route is
  sufficient.
- Anthropic-compatible, Gemini-native or other non-OpenAI-compatible protocols.
- Enabling a ZeroCostRadar `openai-responses` route unless the existing owned
  runtime substrate can support it without a new protocol implementation.
- Changing model quality/ranking, memory semantics, tool approval semantics or
  chat cognition.
- Live paid inference during automated verification.

### Definition of Done

- No execution resolver maps an unknown catalog provider to NVIDIA.
- Unknown/unsupported providers produce an explicit configuration/unsupported
  outcome before network execution.
- Imported supported routes persist enough explicit route metadata to survive
  restart and resolve identically afterward.
- OpenRouter/Groq/Google supported Chat-Completions routes use their exact
  validated endpoint and provider credential.
- Supported OpenCode Radar routes execute exactly through their persisted
  endpoint/auth contract. Current Zen routes require `OPENCODE_API_KEY`; an
  auth-free inference route is eligible only when Radar explicitly publishes
  that distinct endpoint.
- Embedded ACME profiles use explicit compatible-provider entries and provider
  hints; NVIDIA/KIE/native OpenAI keep their current owned paths.
- Direct/reference dispatch reaches the same intended provider endpoint for
  supported compatible routes.
- Radar Add is enabled only when the route's provider + API style is executable
  under this implementation.
- Missing required credentials never fall through to another provider.
- Existing NVIDIA/KIE/OpenAI tests remain green.
- No automated verification performs a paid model call.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `df195008dab303ef3c9bb21e4ca1d0ac9e6d2a3b`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Remove implicit unknown→NVIDIA coercion | PC-01 one shared provider owner; PC-05 explicit execution boundary; PC-06 explicit unsupported outcomes | Prevents a model declared as another provider from being silently sent to NVIDIA | Exact execution-provider resolver; unknown is an error | Unit tests for known and unknown catalog providers; no fetch on unknown |
| Persist explicit compatible route metadata | PC-01 shared engine ownership; PC-06 model controls through runtime/host owner | Imported Radar models remain executable after restart without reconstructing route truth from GUI state | Extend user chat model DTO/catalog with bounded validated endpoint/API-style execution metadata | parse/save/load round-trip and restart-resolution tests |
| Host-owned provider credentials | PC-05 provider credentials outside renderer | Required provider auth can be configured without exposing secrets to GUI state | Extend existing secrets owner and provider settings configured/source flags; never echo values | secret parse/save/source tests and provider-settings HTTP tests |
| Reuse ACME compatible provider execution | PC-01 one shared engine; PC-05 explicit execution | OpenRouter/Groq/Google/OpenCode Chat-Completions execute without four competing engines | Build explicit ACME compatible entries from validated persisted routes | embedded ACME config/dispatch tests verify providerHint, endpoint and auth |
| Truthful Radar import gating | PC-06 source provenance + explicit unsupported outcomes | Plus button becomes useful without claiming unsupported protocols work | Gate on provider/API-style/route validation owned by runtime | GUI/helper tests for supported and blocked routes |

### Minimum Verification Gates

- [x] Focused execution-provider and user-catalog tests pass.
- [x] Focused provider-secrets/provider-settings tests pass.
- [x] Focused embedded-ACME compatible-route tests pass.
- [x] Focused direct-dispatch compatible-route tests pass.
- [x] Focused Zero Cost Radar import-gating tests pass.
- [x] Root typecheck passes.
- [x] Full root test suite passes.
- [x] GUI test suite and production build pass.
- [x] Packed protocol/client verification passes if protocol changes.
- [x] `git diff --check` passes.
- [x] No live paid inference call is made.

## References

- `src/core/execution-provider.ts`
- `src/core/user-catalog.ts`
- `src/core/provider-secrets.ts`
- `src/providers/acme/embedded-acme-chat-transport.ts`
- `src/runtime/chat-dispatch.ts`
- `src/gui-host/provider-routes.ts`
- `gui/src/settings/zero-cost-radar.ts`
- ZeroCostRadar public A008 route feed
- OpenRouter official developer/API docs
- Groq official OpenAI compatibility/API docs
- Google Gemini official OpenAI compatibility docs
- OpenCode official Zen/Inference docs

## Checklist

- [x] Claim A008-0152 on main and create isolated stacked worktree.
- [x] Re-read provider/runtime ownership and verify external provider contracts.
- [x] Freeze necessity gate and scope.
- [x] Remove unknown→NVIDIA coercion and make execution ownership explicit.
- [x] Extend persisted user-model route metadata.
- [x] Extend provider-secret ownership and settings projection.
- [x] Compose compatible routes into embedded ACME.
- [x] Add compatible routes to direct/reference dispatch.
- [x] Make Radar import eligibility execution-aware.
- [x] Add/adjust focused tests.
- [x] Update owning docs.
- [x] Run minimum verification gates.
- [x] Archive, handoff, restore CURRENT_TASK and push.

## Decisions and Notes

- The existing `catalogExecutionProvider()` default-to-NVIDIA behavior is a bug,
  not a fallback contract.
- Provider identity and execution route are separate facts; neither may be
  inferred from “anything not OpenAI/KIE”.
- The current ZeroCostRadar OpenRouter `openai-responses` entry remains blocked
  unless this task can use an already-owned compatible Responses substrate
  without expanding the frozen protocol scope.
- OpenCode official docs currently expose both Zen model endpoints and an
  OpenAI-compatible inference surface whose free chat models may be called
  without Authorization; implementation must preserve that distinction.
- External provider terms are discovery/compatibility evidence, not permission
  for A008 to enable paid fallback.

## Charter Amendment Log

- 2026-09-21: provider-doc verification clarified that current Radar OpenCode
  entries point at Zen, while OpenCode's auth-free free-chat inference surface
  is a distinct endpoint. The frozen goal is unchanged; implementation must
  preserve the imported route rather than substitute endpoints or auth policy.

## Verification

- Root TypeScript typecheck passed.
- Focused provider/runtime/host suites passed 35/35.
- Full root suite passed 720/720 core tests plus 4/4 membership tests.
- Bundled GUI passed 189/189 tests and production build passed.
- Total verified automated tests: 913/913 with zero failures/skips.
- Direct/reference OpenRouter fixture reached exactly
  `https://openrouter.ai/api/v1/chat/completions` with the persisted model id
  and provider-owned Bearer credential.
- Embedded ACME 0.1.6 OpenRouter fixture reached the same endpoint/credential
  through an explicit `compatible[]` route.
- Missing compatible credentials and unknown catalog providers fail before any
  provider fetch; unknown provider no longer reaches NVIDIA.
- Compatible route metadata survives catalog save/reload and mismatched
  provider/base URL/API style is rejected.
- Provider settings prove OpenRouter/Groq/Gemini/OpenCode keys remain write-only
  while configured/source metadata is visible.
- `@a008/protocol` and `@a008/client` packed/installed offline outside the
  repository and external TypeScript consumers compiled and ran.
- Generated OpenAPI contract is current and protocol contract tests pass 5/5.
- `git diff --check` passed.
- Repository-wide `format:check` still reports the existing 77-file baseline
  and was not used to mass-format unrelated files in this bounded task.
- No live model inference or paid provider call was made.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/HOST_PROTOCOL.md` if host settings/DTOs change
- [x] `docs/FILESTRUCTURE.md` if structure changes
- [ ] `docs/JOURNAL.md` on integration/merge per workflow
- [x] archive + handoff

## Handoff and Follow-ups

- Current state: complete and ready for stacked review/merge.
- Next recommended step: merge A008-0151 first, then review/merge A008-0152.
- Blockers: none.
- Child tasks: none.
- Resume condition: none; use handoff and PR state.
- Open questions: compatible-provider Responses routes remain a separate future
  protocol task; native OpenAI Responses remains unchanged and supported.
