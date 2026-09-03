# ADR 0021 — A008 workspace shell

Status: Accepted

Date: 2026-09-03

Decision owner: Operator

Amends: [ADR 0019](0019-a008-owned-gui.md) D6 (visual language) and D7 (module
ownership).

## Context

The owner asked for the look, feel and UX structure of a sibling desktop
application — a fork of an A008 predecessor, built by a collaborator — to be
carried into the A008 GUI.

The current shell is a two-column grid: a header, one `main` column stacking
chat, composer, upload and terminal, and a 16rem settings aside. It works, but
the stack is the problem. Measured in a browser at a 720px viewport with a real
streamed answer, the chat transcript got **237px** while upload and terminal
consumed fixed height whether or not anyone was using them. A008-0048 fixed the
transcript's ability to scroll; it did not give it room.

The reference application solves that with three zones: a left rail carrying
identity, project and live session state; a calm centre; and a right workbench
whose surfaces are **tabs**, so an unused tool costs no vertical space.

## Decision

### D1. Three zones, and the workbench is tabbed

```text
+----------------------------------------------------------+
| header: identity, workspace tabs, runtime status          |
+-------------+--------------------+-------------------------+
| left rail   | centre             | workbench (tabbed)      |
| identity    | conversation       | Terminal | Upload | ... |
| project     | composer           |                         |
| session     |                    |                         |
+-------------+--------------------+-------------------------+
```

The centre owns the conversation and nothing else. Every other surface is a
workbench tab. That is the whole point: A008's primary act is a conversation,
and the previous layout gave it a quarter of the height.

### D2. The visual language is warm-neutral, not a cyan HUD

ADR 0019 D6 left the palette to A008-0037, which chose cyan-on-near-black. The
reference language is near-black with cream and tan accents, generous
letter-spacing on small uppercase labels, and a single restrained accent. A008
adopts that.

The A008 name, mark and wordmark do not change. This is a palette and
typography decision, not an identity one.

### D3. Product vocabulary is not adopted

The reference application names its surfaces Mission, Hive, Workers, Capability
Fabric and Operational Pressure. A008 has none of those things: it has a chat
turn, a memory store, an upload path, and a shell command.

Borrowing that vocabulary would put words in the interface for capabilities
that do not exist, which is the one thing this repository's documents refuse to
do everywhere else. A008 names its surfaces what they are.

What **is** adopted is the reference application's honesty about empty and
disconnected state — "no fake connected state", "empty means empty". A008
already behaves that way; the shell should say so where a user can see it.

### D4. Provenance: inspected, not adopted

Reference: `github.com/felixnissen/a007-frontend`, inspected locally at revision
`10d7733`.

**It declares no license.** There is no `LICENSE` file and `package.json` has no
`license` field. Under ADR 0002 that settles what may happen: the source may be
read, and nothing may be copied into A008, which ships Apache-2.0. No file,
stylesheet, token block or component is lifted. A008 writes its own.

That the author is a project collaborator and the repository is a fork of an
A008 predecessor does not change it. ADR 0002 exists so that an informal
understanding never becomes untracked provenance. If the owner wants the option
to adapt code rather than reimplement, the reference needs a license first, and
that import needs its own task and a `docs/THIRD_PARTY.md` entry.

What was taken is direction, recorded here so it is traceable:

- a warm near-black ground with cream text and a single tan accent, rather than
  A008's current cyan-on-near-black HUD;
- a three-column top bar sized `minmax(220px, 1fr) auto minmax(220px, 1fr)`, so
  identity sits left, workspace tabs centre, runtime status right;
- a workbench expressed as a grid with named layout variants rather than a
  fixed stack.

A008 chooses its own values for all of it.

**One structural detail is worth naming, because A008 has already been bitten by
its absence.** The reference sets `minmax(0, 1fr)` on every grid track and
`min-width: 0; min-height: 0; overflow: hidden` on every pane. That discipline
is exactly what A008-0048 had to repair: `.a008-app` used `min-height: 100%`, a
floor rather than a cap, and the chat transcript grew to 2605px inside a 720px
viewport instead of scrolling. The new shell adopts the discipline everywhere,
not just where a bug was observed.

### D5. Module ownership is re-declared, not suspended

ADR 0019 D7 gives each `gui/src/` directory one owning task. A shell redesign
crosses all of them, so this program takes them in sequence with one owning task
each, and D7 continues to hold afterwards:

| Module | Owning task |
| --- | --- |
| `gui/src/brand/`, `gui/src/app.tsx` | A008-0052 |
| `gui/src/workbench/` (new) | A008-0053 |
| `gui/src/chat/`, `gui/src/composer/` | A008-0054 |
| `gui/src/settings/` | A008-0055 |

`gui/src/terminal/` and `gui/src/upload/` keep their existing owners; A008-0053
moves where they are mounted, not what they are.

### D6. No behaviour changes in this program

Every task here is presentation. The host protocol, the session client, the
upload route and the terminal runner are untouched. A task that finds itself
needing a behaviour change has found a different task.

## Consequences

- The conversation gets the height it should always have had, and adding a
  workbench surface later costs no vertical space.
- The GUI stops looking like a diagnostic panel and starts looking like a
  product, without claiming capabilities it lacks.
- `gui/src/brand/a008.css` becomes the token source for the whole shell, so a
  future palette change is one file.
- The GUI still has no automated layout regression guard. A008-0048 recorded
  why: only a browser can prove a layout and this repository has no browser test
  runner. That gap widens with a bigger shell and should be weighed once this
  program lands.
