# ADR 0026 — GUI session controls and generation parameters

Status: Accepted
Date: 2026-09-06
Task: A008-0065
Amends: ADR 0019 D4 and ADR 0022 host integration contract

## Decisions

1. Add `session/control` and `session/control/ok` frames on WS /v1/session,
   backed by ACP `_a008/session/control`. Operations are inspect, reset, undo,
   model, configure and close. Every operation requires socket session ownership.
   Mutations are serialized with prompts; close may cancel active work.
2. A runtime snapshot carries actual model, effective chat parameters, committed
   user/assistant messages and runtime cwd/project/memory path. System text and
   reasoning are never part of history. New-session and prompt acknowledgments
   may carry this snapshot additively; old frame shapes remain accepted.
3. Model switch starts a new conversation within the owned ACP session; reset
   keeps system/model/settings, undo drops a committed pair. Neither deletes
   durable memory. Exit closes the session; it does not stop the host or page.
4. GET /v1/models adds parameter capabilities and profile defaults. Per-session
   effective settings come from runtime (including environment overrides).
   Configure atomically replaces the chat parameter set for subsequent turns.
   JSON null explicitly omits an optional provider field; omission must survive
   profile/environment merges. Reasoning controls follow verified model-specific
   mappings, and unsupported controls are unavailable with an explanation.
5. The total generation budget is max_tokens: reasoning and visible response
   share this limit. It is not an input/context/spend cap. Temperature is optional
   and GUI values are 0–1. Parameters affect chat only; semantic analysis,
   classification and retrieval keep their own fixed options.
6. Renderer controls and slash commands use the same session client. Runtime
   history owns completed turns; in-flight display is transient. Configuration
   failures preserve previous state and are shown without a model call.

## Consequences

The diagnostic GUI can exercise CLI behavior and tune actual requests. Tests
must prove history and payloads through the real spawned ACP path. No second
provider client or model payload authority is introduced in the host/renderer.
The parameter panel is inspired by the owner-provided image using A008 tokens.
