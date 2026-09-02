# ADR 0003 — Initial runtime and provider boundary

Status: Accepted

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

The legacy CLI mixed model configuration, mutable conversation state, NVIDIA
HTTP details, terminal presentation, and a credential in one script. The first
A008 implementation must be reusable by a future GUI without making NVIDIA or
the terminal the application's internal architecture.

## Decision

- The first product slice is a private single-package Node.js application using
  TypeScript, npm, ESM, and Node.js `>=22.12`.
- `ChatSession` owns transactional in-memory conversation state and depends only
  on the provider-neutral `ChatTransport` contract.
- Provider messages, requests, deltas, results, errors, and model profiles are
  exported independently of CLI and environment setup.
- NVIDIA is one adapter implemented with native `fetch`. The fetch function,
  endpoint, and timeout are injectable for deterministic tests.
- NVIDIA credentials enter only at adapter construction through
  `NVIDIA_API_KEY`. Core modules never read process environment.
- The initial registry contains one officially verified model profile:
  `nvidia/nemotron-3.5-lightning-30b-a3b`.
- Automatic fallback, retry policy, tools, persistence, GUI, and provider
  routing remain outside this boundary.

## Alternatives considered

### Continue the monolithic JavaScript script

Rejected because state, I/O, provider behavior, and secrets would remain coupled
and could not safely serve both CLI and GUI.

### Carry Axios into the new core

Rejected for the first slice. Supported Node runtimes provide native fetch, and
an injected fetch port supplies the test seam without another runtime dependency.

### Start with a workspace/monorepo

Deferred. There is only one implemented package. A GUI integration task may add
workspaces when a second independently owned package actually exists.

### Use a provider SDK as the core abstraction

Rejected. Provider SDK types would leak into application state and make the
future OpenHands and memory boundaries harder to control.

## Consequences

- CLI and future GUI code can share one session and transport contract.
- Automated tests use fake Responses and never require a credential or network.
- Changing providers means adding an adapter rather than rewriting session state.
- The package is not yet a supported public API or published artifact.
- A future task must decide how this transport participates in Agent Canvas,
  ACP, or Agent Server without introducing a second provider-call owner.
