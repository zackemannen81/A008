# Task A008-0032 — GUI host ACP WebSocket bridge

Status: Ready
Owner: A008-worker01
Parent: A008-0030
Branch: `grok/A008-0032-gui-host`
Clone: `C:\code\A008-workers\A008-worker01`

## Write scope

- `src/gui-host/**`
- `test/gui-host*.ts` or `test/gui-host/**`
- `package.json` scripts `gui-host` only (do not rewrite the whole test list
  except appending new test files)
- `docs/handoffs/A008-0032.md`
- `docs/finished/A008-0032_gui-host.md`

Do not edit `gui/`, `src/acp/` internals except to spawn the existing server,
`src/memory/`, or `docs/CURRENT_TASK.md` in the PR (restore the template).

## Goal

Node GUI host that implements ADR 0019 D3–D4: `/health`, `/v1/models`,
`POST /v1/shell` (reuse `src/tools/terminal.ts`), WebSocket `/v1/session`
bridged to `A008-acp` stdio. Credentials stay in process env.

## Gates

- Fake ACP or injected agent: session/new, prompt streams thought+answer,
  cancel, error path
- WebSocket frames never contain `NVIDIA_API_KEY` or `authorization`
- `npm run typecheck` and `npm test`
- Archive, restore CURRENT_TASK template, handoff, PR, do not merge
