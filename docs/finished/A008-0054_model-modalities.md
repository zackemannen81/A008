# Task A008-0054 — Model profile modalities and registry additions

Status: Complete, with a defect corrected by [A008-0055](A008-0055_registry-correction.md)
Owner: Operator
Parent: None
Created: 2026-09-04
Completed: 2026-09-04
Branch: `claude/A008-0054-model-modalities`

## Why

The owner asked for six models to be selectable via `/model`, and supplied a
diagram showing that a vision-capable model takes an image straight to the
provider call rather than through a describe-then-ingest detour. That difference
is a property of the model, and `ModelProfile` had nowhere to record it.

## What changed

`ModelProfile` gained two fields:

- `inputModalities: readonly ModelModality[]` — `"text" | "image" | "video" |
  "audio"`. Every profile must declare at least `text`.
- `verifiedOn?: string` — the date the values were checked against the vendor.

The registry gained `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`.

`docs/HOST_PROTOCOL.md` records that `GET /v1/models` publishes `id` and `name`
only. Modalities are host-side profile data; a client that needs them should ask
for the route to carry them rather than infer capability from an id.

## The five models that were not added

The owner named `kimi-k3`, `muse-glimmer-30b`, `gemma-4-31b-it`,
`deepseek-v4-pro-0813` and `laguna-xs-2.1` as short names. A registry entry needs
the vendor-prefixed id exactly, and the endpoint rejects anything else. Guessing
`moonshotai/kimi-k3` correctly would still have been a guess, and two of the real
prefixes turned out to be unguessable — `muse-glimmer` is `meta`, `laguna` is
`poolside`. They were deliberately left out rather than invented.

## The defect

The omni profile shipped wrong. Both the id and the output budget were taken
from the model card, which names
`nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4` at 20480 tokens. The
vendor's Build tab — the API sample an actual request is modelled on — uses
`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` at 65536.

`verifiedOn` recorded *when* the values were checked without recording *what*
was checked, which is exactly how a wrong source survives a date stamp. Neither
value would have failed a test; both would have failed a live call.

A008-0055 corrects it. The lesson is recorded there: for this vendor the Build
tab outranks the model card, because it is the request.

## Verification

`npm run typecheck` clean; `npm test` 320 core and 75 GUI, 0 fail. No live
provider call was made, which is why the defect reached `main`.
