# Current Task

Task ID: A008-0087
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-09
Last updated: 2026-09-09
Charter frozen at: 2026-09-09T00:16+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/adr/0026-gui-session-controls.md`
- `docs/adr/0028-engine-package-and-panels.md`
- `docs/adr/0033-kie-provider.md`

## Task Summary

Add OpenAI GPT-5.6 Luna as a first-class A008 chat provider so an operator can continue working when NVIDIA quota is exhausted without bypassing the shared runtime, tool approval loop, memory, or credential boundary.

## Task Charter

### Goal

Make `gpt-5.6-luna` selectable in A008 and route its chat, semantic analysis, relation classification, and retrieval-scope classification through OpenAI when that model is active.

### Primary Deliverable

A secure OpenAI Chat Completions transport with structured tool calling, streaming, model controls, write-only API-key configuration, and verified GPT-5.6 Luna profile.

### In Scope

- OpenAI provider transport using `https://api.openai.com/v1/chat/completions`.
- `gpt-5.6-luna` built-in model profile and verified generation capabilities.
- `OPENAI_API_KEY` environment/secrets-file resolution and renderer-safe redaction.
- Provider settings UI for a write-only OpenAI key.
- Runtime dispatch and semantic routing so an OpenAI Luna turn does not require an NVIDIA inference call.
- Unit/integration tests for payloads, streaming, tool calls, dispatch, settings, and model profile.
- Current system/status/protocol/provider documentation and one accepted ADR.

### Out of Scope

- OpenAI Responses API, hosted OpenAI tools, web search, code interpreter, computer use, or image generation.
- Automatic failover from NVIDIA to OpenAI after a 429.
- Additional OpenAI models beyond GPT-5.6 Luna.
- Changing the default A008 model.

### Definition of Done

- `gpt-5.6-luna` appears in the model list with 128K max output and reasoning effort none/low/medium/high/xhigh/max.
- A Luna turn reaches OpenAI, streams text, and returns structured function calls through the existing A008 tool approval loop.
- Tool observations can be sent back to Luna for continuation without entering committed history.
- A Luna session's analyzer/classifier/retrieval-scope calls use OpenAI rather than NVIDIA.
- OpenAI credentials never enter renderer responses, logs, model arguments, or committed source.
- Existing NVIDIA/kie behavior and tests remain green.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `b65be5e`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| OpenAI Luna transport and dispatch | PC-01; ADR 0033 provider pattern | Operator can continue chat/tool work without NVIDIA quota; without it the requested provider is unusable | One dedicated Chat Completions adapter and exact Luna route in the existing dispatcher | Fake HTTP chat + tool-loop tests |
| OpenAI credential handling | PC-05; ADR 0032/0033 renderer boundary | Provider key stays host-owned; omission would leak or force manual source config | Additive secrets-file/environment field plus existing redaction path | secrets/provider-route/redaction tests |
| Luna controls and model profile | PC-06; ADR 0026 model-control contract | Model is selectable with truthful limits and reasoning choices | One verified built-in profile/capability case | registry + parameter tests |
| Provider-isolated semantic calls | PC-01/PC-05; current runtime semantic ownership | A Luna turn must not fail because hidden retrieval classification still consumes NVIDIA quota | Route retrieval scope classification to the active OpenAI model only for OpenAI sessions | runtime request-order/provider URL test |

### Minimum Verification Gates

- [x] `npm test` passes with no skips/failures: 539 core, 4 membership, 119 GUI.
- [x] `npm --prefix gui run build` passes.
- [x] Fake OpenAI requests prove endpoint, authorization boundary, `max_completion_tokens`, reasoning effort, streaming and tool calls.
- [x] A Luna memory-aware turn routes retrieval scope, chat and knowledge analysis to `api.openai.com` with no NVIDIA request.
- [x] `git diff --check` passes and no credential value is tracked.

## References

- Owner direction in this session: NVIDIA rate limits interrupt work; add OpenAI GPT-5.6 Luna.
- OpenAI model/API documentation checked 2026-09-09: GPT-5.6 Luna model id `gpt-5.6-luna`, Chat Completions, streaming, function calling, 128K max output, reasoning efforts none/low/medium/high/xhigh/max.

## Checklist

- [x] Claim A008-0087 on main and push the identity commit.
- [x] Read current provider/runtime/credential and model-control owners.
- [x] Implement OpenAI transport, profile, dispatch and secure key flow.
- [x] Route OpenAI-session semantic scope classification without NVIDIA dependency.
- [x] Update GUI provider settings.
- [x] Verify, document, archive, restore template, commit and push.

## Decisions and Notes

- Use Chat Completions because GPT-5.6 Luna officially supports it, streaming and function calling, and it maps directly to A008's existing provider-neutral tool transcript. Responses API remains out of scope.
- Selecting Luna explicitly selects OpenAI even if the existing kie fallback preference is set; provider-specific model identity outranks fallback preference.
- No automatic 429 failover is introduced because that would add retry/fallback policy beyond the owner's request.

## Charter Amendment Log

- none

## Verification

- pending

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/HOST_PROTOCOL.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADR 0036

## Handoff and Follow-ups

- Current state: Complete; GPT-5.6 Luna is a first-class chat/semantic provider with write-only credentials and the existing tool approval loop.
- Next recommended step: enter the operator-created OpenAI key in Parameters → Provider, select GPT-5.6 Luna and perform an operator-driven live smoke test.
- Blockers: none.
- Child tasks: none.
- Resume condition: repository state and this task record.
- Open questions: none for the bounded implementation.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Append a signed `docs/JOURNAL.md` entry.
