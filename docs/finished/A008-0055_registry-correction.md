# Task A008-0055 — Correct the omni profile and add four verified models

Status: Complete
Owner: Operator
Parent: None
Created: 2026-09-04
Completed: 2026-09-04
Branch: `claude/A008-0055-registry-correction`

## Why

[A008-0054](A008-0054_model-modalities.md) shipped
`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` with the wrong id and the wrong
output budget, and left five owner-named models out because their vendor
prefixes could not be guessed. The owner then opened the vendor pages in the
browser, which made both problems answerable from the primary source.

## The source rule this task establishes

For this vendor, **the Build tab outranks the model card.** The card is prose
about a family of checkpoints and names one of them; the Build tab is the API
sample a request is copied from. A008-0054 trusted a summary of the card and
shipped an id the endpoint would have rejected.

Every value below was read from a Build tab on 2026-09-04. `verifiedOn` now
means that, and the archive says so, because a bare date does not distinguish a
checked value from a checked wrong source.

## The registry

| id | temp | top_p | max_tokens | reasoning budget | modalities |
| --- | --- | --- | --- | --- | --- |
| `nvidia/nemotron-3.5-lightning-30b-a3b` | 1 | 0.95 | 16384 | 16384 | text |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | 0.6 | 0.95 | 65536 | 16384 | text, image, video, audio |
| `moonshotai/kimi-k3` | 1 | — | 16384 | — | text, image |
| `deepseek-ai/deepseek-v4-pro-0813` | 1 | 0.95 | 16384 | — | text |
| `meta/muse-glimmer-30b` | 1 | 0.95 | 8192 | — | text |
| `poolside/laguna-xs-2.1` | 1 | 0.95 | 8192 | — | text |

Modality is read from the sample's payload shape rather than from the model's
description: a `content` array carrying `image_url` means the endpoint accepts
an image there. That is how `kimi-k3` turned out to be image-capable, which its
name does not suggest, and how the four text-only models were confirmed to be
text-only rather than assumed.

`kimi-k3`'s sample carries `reasoning_effort` and `seed`. `ChatGenerationOptions`
has neither. The effort level is left to the provider rather than mapped onto
`enableThinking`, which is a different control and would have been a silent lie
in the profile.

## `gemma-4-31b-it` was not found

The owner named it. The vendor catalogue has no such model; the closest entry is
`google/diffusiongemma-26b-a4b-it`, which is a different model and not a
plausible rename. It is left out, reported rather than substituted.

## What this does not do

The omni model declares `image`, `video` and `audio`. A008 sends none of them.
`ChatMessage.content` is a `string` (ADR 0020 D6), and the vendor's own sample
shows the shape a vision turn needs:

```json
"content": [{"type":"text","text":"…"},{"type":"image_url","image_url":{"url":"…"}}]
```

So the owner's diagram — image straight into the provider call for a vision
model — is blocked by a core contract, not by a registry entry. That is a
claimed task with an ADR, recorded in
[`../backlog/multimodal-chat-content.md`](../backlog/multimodal-chat-content.md).
Until then a declared modality records a capability A008 cannot use.

## Verification

`npm run typecheck` clean; `npm test` 322 core and 75 GUI, 0 fail, 0 skipped.

New cases assert the exact-id rule against three near misses including the
card's `…-NVFP4` name, the image-capable set, and that no profile declares a
reasoning budget without `enableThinking`. The suite fails a profile that has no
`verifiedOn`.

No live provider call was made. The ids are verified against the vendor's own
request sample, not against a response.
