# A008-0071 verification

Date: 2026-09-08
Branch: `A008-0071-nvidia-catalog-images`

## Automated

- `npx tsc -p tsconfig.json --noEmit` — pass
- `npm --prefix gui run typecheck` — pass
- `npm test` — pass (core + membership + 104 GUI)

Covered without live NVIDIA:

- Catalog parse/fetch with injected fetch
- Image payload parse (NIM artifacts and OpenAI b64_json)
- User catalog and secrets round-trip
- Host merge/add, image store locator, settings never echo the key
- GUI start cards, provider panel copy, generateImage client

## Skipped

- Live NVIDIA catalog or image call (needs `NVIDIA_API_KEY` and credits)
- Interactive browser click-through

## Notes

Default image route is FLUX.1-schnell at
`https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell`.
NVIDIA Build Free Endpoint is hosted inference billed against NGC credits.
