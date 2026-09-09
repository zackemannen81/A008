# ADR 0037 — Mobile WebSocket recovery

Status: Accepted
Date: 2026-09-09
Task: A008-0092
Amends: ADR 0019 D4 standalone GUI WebSocket lifetime

## Decision

The standalone A008 GUI may recover the existing ACP session after a brief transport interruption instead of treating one WebSocket as the session lifetime.

`session/new/ok` carries a host-generated 32-byte random resume capability encoded as 64 lowercase hex characters. A disconnected session becomes detached for 45 seconds by default. During that lease, `session/resume` may reattach only the named session with its exact capability; successful recovery returns `session/resume/ok` and the current runtime snapshot when available.

The capability is process-local protocol authority. It stays in renderer memory, is never model context, semantic memory, a provider credential, or durable storage. Explicit session close, lease expiry, or host shutdown invalidates it. This decision does not add cross-device, reload, or host-restart persistence.
The host sends WebSocket protocol pings every 25 seconds by default. If the previous ping remains unanswered at the next heartbeat, the peer is closed. This keeps otherwise idle mobile/NAT/proxy paths active and detects half-open connections without adding an application JSON heartbeat.

The bundled GUI reconnects after unexpected transport loss with bounded delays of 0.5, 1, 2, then 5 seconds, capped at 5 seconds. While recovering it uses the existing `connecting` state without presenting a fatal error. `Allow all` permission state is cleared across transport loss.

An in-flight prompt or control is never replayed. Socket loss aborts host-side active work and rejects the client's pending operation. Recovery resumes only the surviving committed ACP session state.

## Consequences

The host can preserve conversation state across the short network and browser-suspension gaps common on mobile clients without creating a second chat engine or durable session database. The resume capability is bearer authority and therefore must remain bounded, opaque and outside model-visible data.

A still-connected session has no new idle timeout or total-session cap. Recovery does not survive a page reload because the renderer does not persist the capability, and it does not survive a host restart because leases are in memory only. Invalid, already-attached, or expired capabilities fail closed.