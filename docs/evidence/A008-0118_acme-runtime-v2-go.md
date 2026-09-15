# A008-0118 — ACME runtime/2 live GO evidence

Task: A008-0118
Date: 2026-09-15
Status: Complete
Boundary: owner GUI on `project001` and `oldschool`; local ACME
`acme-model-runtime/2` (`engineBuild=acme-0180-local-a008`); live providers
through ACME for text/chat and through existing image transports for images.
No raw model payloads, traces or credentials are published.

## What the screenshots prove

The frozen owner loop is visible as one A008 client, not as a disconnected
provider smoke test:

```text
A008 client
  → model selection
  → ACME runtime/2
  → provider routing
  → model
  → streaming response
  → tools
  → continuation
  → retrieval
  → answer
  → extraction
  → 1x batch relation classification
  → commit
  → next turn retrieves memory
```

ACME-integration did not disable the rest of A008: retrieval, Canvas/artifacts
and the KIE/NVIDIA image path still run.

## Browser evidence

Captured 2026-09-15 from the owner GUI. Host process only; telemetry off.

1. [Muse retrieval against `oldschool`](A008-0118_muse-oldschool-retrieval.png)
   — `meta/muse-glimmer-30b`, connected. Owner asks which neon text the project
   uses. The answer cites stored `demo.js` knowledge (`AGENT008`, `CODE KING`,
   `shadowBlur`, neon rose/cyan), not a generic greeting collision.
2. [Luna image](A008-0118_luna-image.png) — `gpt-5.6-luna` on `project001`.
   Image generation from the existing image path while chat execution is ACME.
3. [DeepSeek image](A008-0118_deepseek-image.png) —
   `deepseek-ai/deepseek-v4-pro-0813` on the same project and image flow.
4. [Code Canvas preview](A008-0118_canvas-preview.png) — session artifact
   preview (`Välkommen till min webbplats!`) beside the generated image.

## Automated evidence

Recorded in the [task archive](../finished/A008-0118_acme-runtime-v2-consumer.md)
and [handoff](../handoffs/A008-0118.md): 636 core, 4 membership, 162 GUI;
typecheck; protocol package; production GUI build; `git diff --check`.
Live chat matrix and two-model owner loop are owner-observed, not replayed here.

## Limitations

- Screenshots are appearance of the live surfaces, not a captured ACME wire.
- Nemotron Omni was not live-tested.
- No credential, PIN, bearer token or model payload is included.
