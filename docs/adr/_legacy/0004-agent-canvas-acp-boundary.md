# ADR 0004 — Agent Canvas ACP boundary

Status: Accepted (amended by ADR 0019)

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

Agent Canvas 1.16 is a frontend for OpenHands Agent Server rather than a simple
chat component. It prohibits direct frontend calls to Agent Server endpoints and
already supports Custom agents that speak stable Agent Client Protocol (ACP) on
stdio. A008 must reuse its existing provider-neutral core and NVIDIA adapter,
not add provider behavior to Canvas or Agent Server.

## Decision

- The first integration uses Agent Canvas as its standalone shell and its
  existing Agent Server as the ACP client/process supervisor.
- Agent Server launches the `A008-acp` executable as a Custom stdio agent. No
  OpenHands repository is modified or vendored for this boundary.
- `A008-acp` implements stable ACP v1 with the exact
  `@agentclientprotocol/sdk` 1.4.0 package. It supports initialization, new
  in-memory sessions, the model config option, text/resource-link prompts,
  streamed thought/answer updates, and cancellation.
- The bridge owns one `ChatSession` per ACP session. Both CLI and ACP use
  `createNvidiaChatSession`, which constructs the existing
  `NvidiaChatTransport`; there is one provider-call implementation.
- Agent Server owns subprocess lifetime and its own external conversation
  record. The A008 ACP session ID and history are process-local and ephemeral.
  Durable cross-component identity is deferred.
- Provider credentials are process environment input. `NVIDIA_API_KEY` is
  required at session construction; an optional operator-controlled
  `NVIDIA_CHAT_COMPLETIONS_URL` selects a trusted proxy or local fake endpoint.
  Neither core modules nor automated tests read `.env.local`.

## Source and dependency boundary

- OpenHands Agent Canvas was inspected at
  `744e8652f254613045b779eb148bf4f741177975` under MIT terms. No source was
  copied and it is not an A008 package dependency.
- `@agentclientprotocol/sdk` 1.4.0 is the official stable TypeScript ACP v1
  implementation under Apache-2.0.
- `zod` 4.5.4 is the SDK runtime peer under MIT.
- Exact dependency artifacts and integrity hashes are fixed by
  `package-lock.json`; licenses are recorded in `docs/THIRD_PARTY.md`.

## Alternatives considered

### Embed Agent Canvas library exports

Deferred. The exports require routing, query, localization, backend, telemetry,
and style providers. Embedding would not remove the need for an Agent Server
contract and is a wider first change.

### Add a new Agent Server endpoint and TypeScript client method

Rejected for this slice. It would require coordinated changes across
software-agent-sdk, typescript-client, and Canvas despite ACP already providing
the required process and event boundary.

### Call NVIDIA directly from Agent Canvas

Rejected. It violates Canvas repository rules, moves credentials into the
renderer-facing system, and creates a second provider owner beside A008.

## Consequences

- Canvas can select A008 through its existing Custom ACP settings and render
  the standard events without an A008-specific frontend fork.
- The bridge remains chat-only: no tools, filesystem access, MCP, rich prompt
  media, load/resume, persistence, memory, or runtime model switching.
- A separate task must install/start the current Canvas and Agent Server stack,
  configure the custom command, and record a real browser/E2E result against a
  local fake endpoint before claiming GUI integration works on this host.

## Amendment

Amended 2026-09-02 by [ADR 0019](0019-a008-owned-gui.md). This record remains
the operator Canvas + Agent Server + `A008-acp` compatibility path. The product
GUI is an A008-owned `gui/` application and `src/gui-host/` ACP WebSocket
bridge. OpenHands source is not modified. PROJECT_BRIEF open decision 1 is
closed: standalone Canvas is not the product client.
