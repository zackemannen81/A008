# ADR 0036 — OpenAI GPT-5.6 Luna chat provider

Status: Accepted
Date: 2026-09-09
Task: A008-0087
Amends: ADR 0033 provider dispatch; ADR 0026 model controls

## Decision

A008 can use OpenAI as a third chat provider through the existing provider-neutral
`ChatTransport` boundary. The first built-in OpenAI profile is `gpt-5.6-luna`.
It remains a normal selectable model; selecting it routes chat through the
OpenAI adapter regardless of the fallback chat-provider setting.

The adapter uses OpenAI Chat Completions so A008's existing assistant tool-call,
tool-result, streaming and approval transcript remains unchanged. No hosted
OpenAI tool, Responses migration, image path or second conversation engine is
introduced by this task.

`OPENAI_API_KEY` is accepted in the host/ACP environment or as the write-only
`openAiApiKey` field in the existing external secrets file. The renderer sees
only configured/missing state and source, never the value. The GUI host injects
the resolved key into a newly spawned ACP child and includes it in wire redaction.
Luna exposes reasoning effort `none`, `low`, `medium`, `high`, `xhigh` and `max`.
Chat defaults to `medium`. A008's internal strict semantic-JSON calls use
`reasoning_effort: none` so their existing deterministic `temperature: 0`
profile remains compatible and independent from chat reasoning settings.

When no NVIDIA credential exists but OpenAI does, the retrieval-scope classifier
uses Luna instead of requiring the NVIDIA default. Thus an OpenAI-only runtime
can complete the same memory-aware turn rather than failing before chat.

## Consequences

Provider-neutral core contracts and tool permissions do not change. OpenAI
provider failures retain typed auth/rate-limit/server/network/cancel outcomes.
Luna is text/image-capable upstream, but A008 chat input remains text-only under
ADR 0020 D6.

Automated verification uses injected fake fetch responses only. A live OpenAI
call requires the owner's locally supplied credential and is not implied by
this decision.
