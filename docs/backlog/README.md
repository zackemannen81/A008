# Backlog Proposals

Discoverability: index. Every member is listed below.
Member state: required. Every member declares a `Status:` line.

These proposals are in project direction but are not active. Activation claims
an A008 task ID and creates a reviewed charter. A proposal keeps its stable path
when its status changes.

## Proposals

| Proposal | Status | Outcome |
| --- | --- | --- |
| [`legacy-credential-remediation.md`](legacy-credential-remediation.md) | Completed | Credential revoked/rotated; secure provider-neutral intake delivered by A008-0003. |
| [`multiagent-process-layer.md`](multiagent-process-layer.md) | Open | Decide whether to install and verify the optional local process supervisor. |
| [`multimodal-chat-content.md`](multimodal-chat-content.md) | Superseded by ADR 0045 / A008-0142 | The inherited text-only `ChatMessage.content` restriction is withdrawn. ADR 0045 owns canonical multimodal committed conversation content; A008-0142 owns the active migration and generated-image transcript behavior. |
| [`current-scope-retrieval.md`](current-scope-retrieval.md) | Built by A008-0063 | The owner's retrieval mechanism written down precisely: classify each message into domains and related domains, accumulate them into a `current_scope` that resets only on an empty intersection, and match a record on any tag, domain or scope hit. Carries five open questions, the sharpest being that gradual topic drift never triggers the reset. |
| [`host-fixture-secrets-isolation.md`](host-fixture-secrets-isolation.md) | Open | A008-0166 left `A008_SECRETS_PATH` unset in `isolatedMemoryEnv`. A later child should point that fixture at a missing temporary secrets file without changing product secret resolution. |


## History / _legacy
for reference purpose you can find old longer authority docs under _legacy