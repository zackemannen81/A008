# ADR 0033 — kie.ai as a second provider

Status: Accepted
Date: 2026-09-08
Task: A008-0073
Amends: ADR 0032 (provider settings gain a second key and job-based images)

## Decision

A008 can call [kie.ai](https://docs.kie.ai/) as an alternative to NVIDIA.

- Chat uses kie.ai's OpenAI-compatible completions URLs
  (`https://api.kie.ai/<model>/v1/chat/completions`) through a dedicated
  `KieChatTransport`. NVIDIA chat is unchanged.
- Image generation for kie models uses the Market jobs API:
  `POST /api/v1/jobs/createTask` then poll `GET /api/v1/jobs/recordInfo`.
  Result URLs are downloaded into the existing source blob store.
- Credentials: `KIE_API_KEY` in the environment, or a write-only `kieApiKey` in
  `~/.a008/secrets.json`. The renderer never reads the value. Chat completions
  still run in ACP; the host injects the resolved key into the ACP child env.
- Which stack is used is stored in the user catalog: `chatProvider` and
  `imageProvider` are `nvidia` or `kie`. A chat model whose profile
  `provider` is `kie` also selects the kie transport.
- Video, music and Claude/Grok native message APIs are out of this slice.

kie.ai is an aggregator. Model availability, pricing and stability are theirs.
Generated media URLs expire; A008 stores a local copy.

## Consequences

A runtime can start with only a kie key. NVIDIA remains the default when both
are configured and the selected model is from the built-in NVIDIA registry.
Extra NVIDIA-specific request fields are not sent on kie chat calls.
