# ADR 0022 — The A008 GUI is a test surface; the product client is external

Status: Accepted

Date: 2026-09-04

Decision owner: Operator

Supersedes: the programme in [ADR 0021](0021-workspace-shell.md) D5. Amends
[ADR 0019](0019-a008-owned-gui.md) D2.

## Context

ADR 0019 D2 made `gui/` plus `src/gui-host/` the product GUI. ADR 0021 then
planned a four-task programme to turn that surface into something that looks
like a product.

The owner has since agreed with the collaborator who maintains
`felixnissen/a007-frontend` that the standalone frontend client will be able to
run against either A007 or A008, and that final product UI and UX belong to that
client. The reasoning the owner gave is worth recording because it is the whole
decision: it is better that the collaborator owns the standalone frontend
client.

That makes ADR 0021's premise false. A008 is no longer building the interface a
user will meet.

## Decision

### D1. `gui/` is a live-test surface, not the product

It exists so A008's own behaviour can be exercised end to end on this machine:
a real host, a real `A008-acp` subprocess, a real memory runtime. It stays
usable and honest. It stops being a design project.

The A008-0052 shell stays. It was merged, it measured a transcript at 545px
against the previous 237px, and a test surface that cannot show a long answer is
a bad test surface. Nothing about it is reverted.

### D2. ADR 0021's remaining programme is cancelled

The chat, composer and settings restyling tasks named in ADR 0021 D5 are
withdrawn. They were never claimed in `docs/TASK_IDS.md`, so nothing is
abandoned mid-flight; the ownership table simply no longer describes planned
work.

ADR 0021 D2 (the warm-neutral palette) and D4 (provenance) stand as the record
of what was done and why.

### D3. The host protocol becomes an integration contract

This is the part that now matters. An external client written by someone else
will speak to `src/gui-host/`. Until now the protocol existed only inside
ADR 0019 D4 and ADR 0020 D3, as decisions rather than as a specification.

A008 owes that client one document that is complete enough to implement
against without reading this repository's decision history, and a protocol that
does not change under it without notice.

### D4. An external client needs a named origin, not a weakened guard

`isAllowedOrigin` accepts a request with no `Origin` header, and otherwise
requires same-host or loopback over http/https. A desktop client whose renderer
loads from `file://` sends `Origin: null`, and one on a custom scheme sends
something that is not http or https. Both are refused today.

The guard is not wrong. It exists because `POST /v1/shell` runs a real command
in the host's working directory, and a page in the user's browser must never
reach it. Relaxing it to admit `null` would admit every local HTML file.

So the guard is not relaxed. An operator may instead **name** additional
origins explicitly, defaulting to none. A client that needs access is
configured in, rather than a whole class of callers being let in.

This does not make the loopback surface safe against a hostile local process.
It never was: any process on the machine can already speak to a loopback port.
The origin guard's threat model is the user's browser, and that is unchanged.

## Consequences

- A008's GUI work stops competing with the product client. Effort moves to the
  contract between them.
- The protocol becomes something A008 can break only deliberately, because
  someone else depends on it.
- `docs/HOST_PROTOCOL.md` becomes the artefact an external implementer reads.
  ADR 0019 D4 and ADR 0020 D3 remain the decisions; the document is the surface.
- A008 still has no automated browser-level guard for its own GUI, and now has
  less reason to add one: the surface that matters for a user is not this one.
