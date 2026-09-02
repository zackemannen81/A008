# First shared chat slice

Status: Completed by A007-0003 through A007-0005.

## Discovery context

A007-0003 now provides the provider-neutral core, secure NVIDIA adapter, and thin
CLI. OpenHands Agent Canvas provides a GUI, Electron shell, and component
library, but its frontend speaks Agent Server contracts and does not expose a
simple standalone application component.

## Proposed outcome

A user selects one NVIDIA model, sends one message through the Agent Canvas chat
surface, and sees the answer stream. A thin CLI invokes the same provider-neutral
core. Credential input is external. Memory is a stable port backed by an
in-memory or no-op adapter.

ADR 0004 chooses the first integration path:

1. Agent Canvas remains the standalone shell;
2. its existing Agent Server launches the `a007-acp` Custom stdio agent; and
3. the bridge reaches the shared a007 core and existing NVIDIA adapter.

A007-0004 proves the compiled protocol process against the official ACP client
and a local fake NVIDIA endpoint. A007-0005 completes the proposed outcome with
a running Canvas/Agent Server stack, a browser message, the same a007 adapter,
and a visible deterministic loopback response.

## Completion evidence

The durable runtime facts and safe screenshot are recorded in
[`../evidence/A007-0005_agent-canvas-runtime-proof.md`](../evidence/A007-0005_agent-canvas-runtime-proof.md).
The proof is not a live-provider, packaging, persistence, tools, memory, or
fully hermetic external-egress claim.

## Dependencies

- `legacy-credential-remediation.md` (completed by A007-0003).
- Pin OpenHands commit and preserve its MIT notice.
- Install or otherwise provide the Agent Canvas/Agent Server runtime without
  mutating the pinned source boundary unexpectedly.
- Decide the first durable conversation-ID mapping; process and provider-call
  ownership are fixed for the proof by ADR 0004.

## Suggested verification

- Shared provider contract tests and fake SSE integration.
- CLI and GUI scenario tests that produce equivalent conversation events.
- OpenHands lint, unit, app build, library build, and package dry-run for any
  adapted surface.
- Electron/Windows installed-app smoke test if desktop packaging enters scope.
- No live model or paid call without explicit authority.
