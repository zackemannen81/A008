# A008-0093 — Global app theme evidence

Task: A008-0093. Local GUI presentation only. No host, ACP, provider or memory writes.

## Automated

- `npm test`: 543 core, 4 membership, 143 GUI tests, zero failures.
- `npm --prefix gui run build`: production Vite build, including the early
  `data-a008-theme` boot script in `gui/dist/index.html`.
- Focused GUI tests cover unknown/missing default, Neutral and Deep Space
  round-trip, unrelated preference preservation, live root-attribute switching,
  Appearance markup, session isolation, CSS token contract, Neutral value
  extraction, Relationship Map theme-agnostic source, and Code Canvas preview
  isolation.

## Browser

Headless Edge against the production GUI build (`http://127.0.0.1:4173/`) and
the synthetic Memory preview (`http://127.0.0.1:5194/__memory-map-check`).

| Shot | Observation |
| --- | --- |
| [Neutral desktop](A008-0093_neutral-desktop.png) | Current charcoal shell, pale Send control, gray selected Chat. |
| [Neutral narrow](A008-0093_neutral-narrow.png) | Same palette at 390×844; navigation toggle remains. |
| [Deep Space desktop](A008-0093_deep-space-desktop.png) | Blue-black/navy surfaces, electric-blue brand and Send, blue selected Chat. Layout unchanged. |
| [Deep Space narrow](A008-0093_deep-space-narrow.png) | Same material on a narrow viewport. |
| [Memory Neutral](A008-0093_memory-neutral.png) | Charcoal Memory Overview; gold/green/gray kind dots; gray domain bars. |
| [Memory Deep Space](A008-0093_memory-deep-space.png) | Navy Memory Overview; cyan identity, green state, violet claims, amber events, blue artifacts; accent domain bars. |

Parameters Appearance cards are covered by GUI DOM tests (`aria-pressed`, both
theme names). Code Canvas preview isolation is covered by `buildPreviewDocument`
tests: no `data-a008-theme` and no `--a008-*` tokens enter the srcdoc document.

No live provider call, credential, or runtime settings write participated.
