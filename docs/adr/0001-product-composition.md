# ADR 0001 — Product composition

Status: Accepted

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

The owner requested an application that combines the observed legacy CLI,
OpenHands' GUI/client, multi-agent development, and add-ons such as the owner's
semantic memory engine. The source inputs have different architectures and must
not become parallel, conflicting state owners.

## Decision

a007 will be one product with:

- a shared application core used by both CLI and GUI;
- legacy CLI behavior preserved through clean contracts and tests rather than
  wholesale source copying;
- OpenHands Agent Canvas used as the candidate GUI/client source;
- a new semantic-memory engine implemented as an optional backend capability
  from an a007-owned contract derived from the Context-First model; and
- docs-first repository governance with isolated multi-agent execution.

This decision fixes product composition only. It does not yet choose standalone
Canvas versus component embedding, ACP versus an Agent Server extension,
provider-call ownership, memory topology, storage, packaging, or telemetry.

## Alternatives considered

### Continue the legacy CLI alone

Rejected because it does not satisfy the owner-directed GUI and add-on goal.

### Fork all source trees into one monolith

Rejected because it loses upstream ownership boundaries, creates parallel state
models, and makes license/security review harder.

### Build unrelated CLI and GUI clients

Rejected because provider behavior, conversation identity, and memory would
drift across two implementations.

## Consequences

- The first product slice must prove a shared core across CLI and GUI.
- External source is pinned and adapted behind contracts before import.
- Memory and agent execution stay outside the browser renderer.
- Detailed topology remains an explicit follow-up decision.
