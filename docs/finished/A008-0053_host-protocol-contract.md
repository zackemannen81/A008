# Task A008-0053 — Host protocol as an integration contract

Status: Complete
Owner: Operator
Parent: ADR 0022
Created: 2026-09-04
Completed: 2026-09-04
Branch: `claude/A008-0053-host-protocol-contract`

## Why

The owner moved product UI and UX to the standalone client maintained outside
this repository, which will run against either A007 or A008. A008's job at that
boundary changed from building an interface to being implementable against.

Two things were missing for that.

## 1. The protocol was decisions, not a specification

It lived in ADR 0019 D4 and ADR 0020 D3, in the middle of reasoning about why
each choice was made. An external implementer should not have to read this
repository's decision history to write a client.

`docs/HOST_PROTOCOL.md` is now the complete surface: four HTTP routes, the
WebSocket frames in both directions, the failure body, every environment
variable, and an explicit list of what the protocol does **not** have — no
auth, no resume, no versioning handshake — so a client does not wait for them.

It also states the one rule a client can silently break: `thought` and `answer`
are separate channels. A008 enforces the separation on its side; a client that
concatenates them destroys the guarantee for its own users.

## 2. The origin guard refuses the client that is coming

`isAllowedOrigin` accepts a request with no `Origin` header, and otherwise
requires same-host or loopback over http/https. A desktop renderer loading from
`file://` sends `Origin: null`, and one on a custom scheme sends a non-http
value. Both were refused.

The guard was not relaxed. Admitting `null` as a class would admit every local
HTML file, and `POST /v1/shell` runs a real command in the host's working
directory. Instead an operator may **name** origins:

```bash
A008_GUI_HOST_ALLOWED_ORIGINS="null,app://your-client"
```

Comma-separated, matched literally after trimming and lowercasing, empty by
default. Naming one origin admits that one and nothing else. The list is read
once and used by both the HTTP routes and the WebSocket upgrade, so the two
cannot drift apart.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` | 317 core + 75 GUI, 0 fail |

Three new cases: an unnamed origin is refused where a named one is admitted,
the list is empty unless set, and a named origin reaches both `POST /v1/shell`
and the WebSocket upgrade while an unnamed one is refused by both.

### Mutation check

| Mutation | Result |
| --- | --- |
| allowlist ignored | 315 pass, **2 fail** |
| explicit `null` branch removed | 317 pass, 0 fail |

The second is worth recording rather than hiding. Removing the `=== "null"`
branch changes nothing, because `new URL("null")` throws and the request is
refused one line later. The branch is defence in depth against a parse that
might one day accept it, not live logic. The *behaviour* — `null` refused
unless named — is covered; that specific line is not, and cannot be without
weakening the parser it guards.

## Not done

- No authentication. A token would be the right answer for a non-loopback
  deployment and the wrong complexity for a loopback one; nothing here needs it
  yet, and the protocol document says so plainly rather than leaving a gap.
- No versioning handshake. `GET /health` is the whole negotiation, and clients
  are told to ignore unknown frame types so additions do not break them.
- No change to any route's behaviour.
