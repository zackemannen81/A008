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

## Verified endpoint controls

The hosted API references were checked on 2026-09-06. They take precedence over
weight-card examples for the request schema; Build samples continue to own the
registry's original sampling defaults.

| Model | Generated-token ceiling | Reasoning controls | Extras |
| --- | --- | --- | --- |
| [Nemotron Lightning](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-5-lightning-30b-a3b-infer) | 32768 | enable_thinking; reasoning_budget −1..32768 | top P, seed, stop |
| [Nemotron Omni](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-nano-omni-30b-a3b-reasoning-infer) | 65536 | enable_thinking; reasoning_budget −1..32768 | top P, seed |
| [Kimi K3](https://docs.api.nvidia.com/nim/reference/moonshotai-kimi-k3-infer) | 65536 | reasoning_effort low/high/max; no off | seed; top P is fixed |
| [DeepSeek V4 Pro](https://docs.api.nvidia.com/nim/reference/deepseek-ai-deepseek-v4-pro-0813-infer) | 16384 | reasoning_effort none/high/max | top P, seed |
| [Muse Glimmer](https://docs.api.nvidia.com/nim/reference/meta-muse-glimmer-30b-infer) | 131072 | reasoning_effort none/minimal/low/medium/high/max | top P, seed, stop |
| [Laguna XS](https://docs.api.nvidia.com/nim/reference/poolside-laguna-xs-2-1-infer) | 16384 | no exposed request control | top P |

Nemotron toggle semantics are also documented in the
[Omni API model reference](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-nano-omni-30b-a3b-reasoning)
and [Lightning Build sample](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b).
The shared adapter maps the older DeepSeek `enableThinking` option to the
documented `chat_template_kwargs.thinking`, while the GUI uses reasoning_effort.
It omits unrecognized template toggles for the other effort-only endpoints.

The GUI supports the requested 0–1 temperature range and nonnegative safe
integer seeds as deliberate subsets of wider provider ranges. No live model
quality or endpoint acceptance claim is inferred from the fake-provider tests.
