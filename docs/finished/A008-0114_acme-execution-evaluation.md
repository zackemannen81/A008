# A008-0114 — ACME execution substrate evaluation (Stage 3.5)

Task ID: A008-0114
Parent Task: A008-0103
Status: Complete
Owner: Grok (delegated)
Created: 2026-09-15
Last updated: 2026-09-15
Charter frozen at: 2026-09-15; contract revision `3532bcd`

## Outcome

Stage 3.5 is complete. `AcmeChatTransport` implements the existing A008
`ChatTransport` contract against frozen `acme-model-runtime/1`. It is selectable
only by explicit local composition (`A008_CHAT_TRANSPORT=acme`). Direct NVIDIA,
kie.ai and OpenAI transports remain the default and the authoritative execution
path.

Deterministic parity fixtures show equivalent A008-visible chat, tool-loop,
semantic JSON and knowledge outcomes from equivalent normalized model output.
Failure fixtures preserve ACME execution evidence and never fall back to a
direct provider after ACME dispatch.

## Adoption decision: NO-GO

ACME is **not** adopted as A008's normal provider-execution substrate.

- A **go** would have authorized a later task to make ACME the default route.
- This **no-go** leaves current direct provider execution authoritative.
- A008-0103 Stage 4 proceeds **without** ACME and must not reuse ACME
  `modelExecutionId` as A008 `commandId`/`turnId`/event-sequence authority.

Reasons:

1. Frozen ACME `ModelRequest` accepts only `temperature`, `maxOutputTokens` and
   `stop`. A008 generation controls `topP`, `reasoningBudget`, `enableThinking`,
   `reasoningEffort` and `seed` cannot be represented and are omitted. Default
   NVIDIA thinking profiles would silently lose provider-facing controls.
2. ACME-0176 published and froze `acme-model-runtime/1` (Accepted
   2026-09-15; consumed from `C:\code\acme\docs\design\acme-model-runtime-1.md`).
   ACME's own task charter was still Ready / not archived Complete at evaluation
   time (ACME `HEAD` `f6aec57`).
3. The adapter remains available as a non-authoritative opt-in control path.

The adapter is kept, not removed, because the evaluation deliverable is the
adapter plus the decision. SYSTEMDOC keeps the direct path as current behavior
and describes ACME only as explicit opt-in.

## Protocol identity

| Field | Value |
| --- | --- |
| Protocol | `acme-model-runtime/1` |
| Compatibility | `GET /v1/model/compatibility` |
| Execute | `POST /v1/model/execute` |
| Forbidden | ACME `/v1/execute` task runtime |
| Header | `x-acme-model-runtime-protocol: acme-model-runtime/1` |
| ACME design | `C:\code\acme\docs\design\acme-model-runtime-1.md` |
| ACME ADR | ADR-0053 |
| ACME git at evaluation | `f6aec57` Freeze-ACME-0176-model-execution-runtime-charter |

## What shipped

- `src/providers/acme/acme-chat-transport.ts`
- `src/providers/acme/acme-model-runtime.ts`
- `src/providers/acme/acme-sse.ts`
- Explicit composition: `A008_CHAT_TRANSPORT`, `A008_ACME_MODEL_RUNTIME_URL`,
  optional token and `engineBuild` pin
- Parity and failure tests under `test/acme-*.test.ts`

`ChatSession` cognitive/tool-loop ownership is unchanged. Semantic JSON still
parses in A008. Provider credentials are not placed in ACME model content.

## Necessity review

Actual diff matches the frozen gate: one adapter under `ChatTransport`, no
cognition moved, no Stage 4 recovery, no post-dispatch fallback, no ACME types
in memory/knowledge/orchestration.

## Verification

- [x] Compatibility/descriptor checked before execute; unexpected protocol
  versions and pinned `engineBuild` mismatches fail before execute.
- [x] Text, reasoning deltas, usage/finish, tools and tool-result continuation
  pass through `AcmeChatTransport`.
- [x] Direct-vs-ACME ChatSession, semantic JSON and local-runtime knowledge
  fixtures match from equivalent normalized output.
- [x] Empty answer, truncated tool stream, disconnect, timeout, cancel, 429/5xx,
  malformed terminal data, ambiguous delivery and transport refusal are
  deterministic; truncated tools are not executed; knowledge is not mutated.
- [x] No automatic direct-provider fallback after ACME dispatch; `/v1/execute`
  is never called.
- [x] Source scan: `src/memory` and `src/orchestration` do not import ACME.
- [x] `npm test`: 626 core + 4 membership + 162 GUI, zero failures.
- [x] `npm run verify:protocol` PASS.
- [x] Production GUI build PASS.
- [x] Portable engine proof PASS
  (`C:\code\A008-packages\A008-0114-engine` →
  `C:\code\felix-a007\a007-frontend`).
- [x] `git diff --check` PASS.
- [x] No live provider call, deployment or Tauri/Expo modification.
- [x] Go/no-go recorded before Stage 4. Stage 4 was not started.

## Charter (frozen)

Goal, deliverable, scope, out-of-scope, definition of done and necessity gate
are unchanged from the Ready charter in `docs/CURRENT_TASK.md` at
`2026-09-15` / contract revision `3532bcd`.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md` (opt-in adapter; default remains direct)
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/tasks/A008-0103_stable-client-api-program.md`
- [x] ADR 0043 unchanged; no new decision conflict
