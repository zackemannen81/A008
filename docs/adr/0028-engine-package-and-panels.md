# ADR 0028 — Complete engine distribution and session-bound panels

Status: Accepted
Date: 2026-09-07
Task: A008-0067
Amends: ADR 0019, ADR 0022, ADR 0026, ADR 0027

## Decision

A008 is distributed as an independently owned engine with its existing web views.
The external client owns the surrounding workbench. A generic advertised engine
panel opens A008's own views; no frontend source is copied across repositories.

The engine owns project runtimes and ACP sessions. A panel attaches to a named
existing session through an ephemeral capability, and uses the same runtime as
external chat. A panel disconnect does not destroy the client's session. Engine
shutdown cancels work and releases listeners, tool processes and SQLite owners.
Global settings remain outside distribution files. Project memory is selected
from the session's actual workspace, not the engine installation directory.

The launchable manifest remains compatible with Agent 007 brain schema v2.
Dynamic panel descriptors are versioned ACP extension metadata, negotiated at
initialization/session creation; these are not invented standard ACP fields.
The descriptor includes a loopback URL scoped to the session and process
lifetime. Client native code validates it; the embedded renderer receives no
Node privilege or provider credentials.

Model tools are explicit typed definitions and structured provider calls. Only
those calls can trigger execution, never command-shaped text in a response or
retrieved document. Results return to the same bounded invocation loop. Tool
permissions and user-written instructions are separate. Executable operations
require explicit session/client approval; cancellation denies pending approvals.
Shared MCP server descriptors come from the existing native client policy.
A008 does not infer execution authority from the optional coding prompt.

Generated reasoning stays display-only. Tool observations are untrusted context,
not system instructions; post-output knowledge receives the original question
and final answer under the existing memory boundary.

## Consequences

Packaging alone cannot supply tool calling or session synchronization: both must
be verified. Existing standalone CLI/GUI paths remain available over the shared
core. The engine bundle contains runtime code, UI assets, discovery metadata,
dependency/license material and launch instructions, not user memory, settings,
credentials or optional prompt text.

