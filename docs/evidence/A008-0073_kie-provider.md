# A008-0073 verification

Date: 2026-09-08
Branch: `A008-0073-kie-provider`

## Automated

- `npx tsc -p tsconfig.json --noEmit` — pass
- `npm --prefix gui run typecheck` — pass
- `npm test` — pass (485 core, 4 membership, 105 GUI)

Covered without live kie.ai or NVIDIA:

- Kie chat JSON and SSE with injected fetch
- Jobs createTask / recordInfo parse, poll, and PNG download
- Dispatch: curated kie id, NVIDIA registry id, `chatProvider` rewrite
- User catalog defaults; secrets round-trip of `kieApiKey`
- Host kie catalog, write-only key POST, kie image blob locator
- GUI Provider panel copy (docs.kie.ai, Market jobs, write-only key)

## Skipped

- Live kie.ai or NVIDIA call
- Interactive browser click-through
- Video / music / Claude `/messages` / GPT `/responses`

## Notes

Default kie chat model is `gemini-3-flash` at
`https://api.kie.ai/gemini-3-flash/v1/chat/completions`.
Default kie image model is `flux-2/flex-text-to-image` via Market jobs.
Media URLs expire; A008 stores a local copy in the source blob store.
