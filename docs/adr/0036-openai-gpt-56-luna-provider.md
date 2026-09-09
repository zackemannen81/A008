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
Chat defaults to `medium` when no function tools are attached. OpenAI Chat
Completions rejects Luna function tools with non-`none` reasoning effort, so a
tool-enabled Luna request is normalized to effective `reasoning_effort: none`.
A008 omits `temperature` entirely for Luna, including internal strict
semantic-JSON calls; those semantic calls also use `reasoning_effort: none`.

When no NVIDIA credential exists but OpenAI does, the retrieval-scope classifier
uses Luna instead of requiring the NVIDIA default. Thus an OpenAI-only runtime
can complete the same memory-aware turn rather than failing before chat.

## Consequences

Provider-neutral core contracts and tool permissions do not change. Explicit
model identity wins provider routing: selecting Luna routes OpenAI, while a
selected NVIDIA/Kimi/etc. model is not hijacked by a saved OpenAI provider
preference. OpenAI provider failures retain typed outcomes and a bounded
provider error message for actionable 4xx diagnostics. Luna is text/image-capable
upstream, but A008 chat input remains text-only under ADR 0020 D6.

A008-0087 used injected fake responses for acceptance. A008-0088 additionally
performed an owner-authorized live smoke call with the locally configured key,
without printing or committing the credential, to verify the tool-compatible
wire shape against OpenAI. A008-0089 confirmed that streaming chunks can carry
`usage: null`; those chunks are now accepted until a later non-null usage object
arrives, preserving streaming without inventing token counts.
