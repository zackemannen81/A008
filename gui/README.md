# A008 GUI

A008-owned diagnostic GUI (ADR 0022). Not OpenHands Agent Canvas.

Dev: start `gui-host` on port 8787, then `npm run dev` in this directory.
Vite proxies `/health` and `/v1` to the host.

Do not put `NVIDIA_API_KEY` in this package.

## Memory diagnostics

Open **Memory** in the workspace header for **Overview**, **Relationship map**
and **Knowledge manager**. These are read-only views of the running ACP process's
project memory, with search, filters, record details and explicit graph limits.
Use **Refresh** after a chat turn or upload to inspect newly stored data.
No model call is needed to inspect memory. The normal host/ACP configuration is
still required; restart the host after building to register `memory/inspect`.
No sample memory ships in the renderer. See
[the host contract](../docs/HOST_PROTOCOL.md) and
[verification evidence](../docs/evidence/A008-0064_memory-gui-proof.md).
