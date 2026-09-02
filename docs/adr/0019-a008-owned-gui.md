# ADR 0019 — A008-owned GUI

Status: Accepted

Date: 2026-09-02

Decision owner: Grok (operator / boss)

Amends: [ADR 0004](0004-agent-canvas-acp-boundary.md)

Closes PROJECT_BRIEF open decision 1.

## Context

A008-0004/0005 proved that standalone OpenHands Agent Canvas can reach the
shared A008 core through Agent Server and `A008-acp`. That path is an operator
compatibility surface. It is not the A008 product GUI: Canvas remains an
OpenHands frontend, requires Agent Server, and is not adapted to A008 memory,
slash commands, or the native terminal tool.

The owner asked for full GUI support as an A008-designed client built on the
OpenHands GUI as UX/architecture input, not as the shipped application.

OpenHands Agent Canvas at `C:\code\OpenHands` revision
`744e8652f254613045b779eb148bf4f741177975` is MIT-licensed. It is not A008
truth and must not be modified for this program. Wholesale copy is rejected
(ADR 0002, PROJECT_BRIEF non-goal).

A browser cannot speak ACP stdio. Canvas solves that with Agent Server. A008
solves it with an A008 process.

## Decision

### D1. Product GUI is A008-owned

The product UI lives in this repository under `gui/`. Branding, routes, and
copy say A008. OpenHands, Agent Canvas, and Agent Server names do not appear
as product identity.

### D2. Two GUI paths

```text
Product path (this ADR)
  browser  ->  A008 GUI host (HTTP + WebSocket)
           ->  A008-acp (stdio ACP)
           ->  createLocalMemoryRuntime
           ->  one NVIDIA ChatTransport

Operator path (ADR 0004, still valid)
  Agent Canvas -> Agent Server -> A008-acp -> same core
```

The operator path is not deleted. It is not the product.

### D3. GUI host owns the ACP subprocess

`src/gui-host/` is a Node process. It:

- serves the built GUI;
- spawns `A008-acp` on stdio;
- bridges a documented JSON WebSocket to ACP;
- reads `NVIDIA_API_KEY` and memory settings from process environment;
- never sends credentials, `.env.local`, or authorization headers to the
  renderer.

### D4. Host protocol v1

```text
GET  /health              { ok: true, name: "A008-gui-host" }
GET  /v1/models           { models: [{ id, name }] }
POST /v1/shell            { command } -> { stdout, stderr, exitCode, timedOut, truncated }
WS   /v1/session

client: { type: "session/new",    requestId, model? }
server: { type: "session/new/ok", requestId, sessionId }
client: { type: "prompt",         requestId, sessionId, text }
server: { type: "thought",        sessionId, text }
server: { type: "answer",         sessionId, text }
server: { type: "prompt/ok",      requestId, sessionId }
client: { type: "cancel",         requestId, sessionId }
server: { type: "error",          requestId?, sessionId?, message }
```

No Agent Server REST/WebSocket schema is used. No OpenHands TypeScript client.

### D5. Adaptation, not a Canvas fork

Wave 1 writes A008 React (Vite) that follows Canvas UX: transcript, thought
stream, composer, settings, terminal. It does not import `@openhands/*`,
PostHog, or Canvas routes.

If a later task copies a bounded MIT file from the pinned OpenHands revision,
it must record path, revision, and the MIT notice in `docs/THIRD_PARTY.md`.
No such copy is authorized in A008-0032..A008-0037.

### D6. Renderer rules

- No provider calls from the browser.
- No `NVIDIA_API_KEY` in frontend source, localStorage, or WebSocket payloads.
- Slash commands in the composer match the CLI set from A008-0029.
- `/shell` runs in the GUI host process cwd via `POST /v1/shell`, not in the
  browser. Reuse `src/tools/terminal.ts`.
- Telemetry defaults off; none is shipped in this program.

### D7. Layout module ownership

`gui/src/app.tsx` is the shell. Feature modules own only their directories:

| Module | Owner task |
| --- | --- |
| `src/gui-host/` | A008-0032 |
| `gui/src/session/` | A008-0033 |
| `gui/src/chat/` | A008-0034 |
| `gui/src/composer/` | A008-0035 |
| `gui/src/terminal/` | A008-0036 |
| `gui/src/settings/` and `gui/src/brand/` | A008-0037 |

Do not edit another module's directory. Do not edit `gui/src/app.tsx` except
A008-0037 may add CSS classes under `.a008-app` in `gui/src/brand/`.

## Alternatives considered

### Keep standalone Canvas as the product GUI

Rejected by the owner. Canvas is not A008-adapted and keeps Agent Server as a
required product runtime.

### Embed Canvas library exports

Rejected for this program. Exports need routing, i18n, backend, and telemetry
providers. Embedding would still be an OpenHands UI.

### Copy the OpenHands `src/` tree into A008

Rejected. Wholesale copy, telemetry, and Agent Server coupling.

### Call NVIDIA from the renderer

Rejected. Second provider owner and credentials in the browser.

## Consequences

- Product `npm` GUI scripts launch A008 host + Vite, not `dev:minimal`.
- ACP remains the only chat protocol into the core.
- Desktop packaging, live NVIDIA GUI E2E, and MIT file imports remain later
  tasks.
