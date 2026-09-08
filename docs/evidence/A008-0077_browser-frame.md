# A008-0077 verification

Date: 2026-09-08
Branch: `A008-0077-browser-frame`

## Automated

- `npx tsc -p tsconfig.json --noEmit` — pass
- `npm --prefix gui run typecheck` — pass
- `node --test dist/test/browser-frame.test.js dist/test/core-suite-membership.test.js` — pass
- `npm --prefix gui run test` — pass (116 GUI)

Covered without live ChatGPT/NVIDIA loads:

- chatgpt.com and build.nvidia.com CSP fixtures refuse A008's origin
- Report-Only CSP does not block
- X-Frame-Options DENY
- Probe failure still tries the iframe
- Blocked viewport has no `<iframe>` and offers Open in browser

## Skipped

- Live GET to chatgpt.com / build.nvidia.com
- Interactive browser click-through

## Notes

`frame-ancestors` is set by the target site. A008 cannot override it. A native
top-level webview (not an iframe) would be a later desktop-client change.
