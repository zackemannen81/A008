# Local platform backend

Opt-in composition of `PlatformStore`, the V3 HTTP contract, and trusted
conversation seeding inside the GUI host. It is not a second cognition stack.
Text runs use the project runtime's `openSession({ model, conversationSeed })`
and exactly one `turn`, with no tools and no durable approval.

## Opt-in

Set `GuiHostOptions.platformPath` or `A008_PLATFORM_PATH` to an absolute file
outside the repository and distinct from semantic-memory storage. Without it,
`GET /v3/info` returns `available: false` and an empty capability list, and no
platform database is opened. V1 and V2 behavior is unchanged.

With it, the process holds `acquireRuntimeLease(path, "platform")` for its
lifetime. A second process using the same file fails before it serves traffic.
If the HTTP bind fails after the lease is taken, the lease and database are
released.

The tenant is the fixed server-owned id `local`. Resource routes require the
existing V2 PIN or device credential. The `session` capability is the only
capability mapped onto this surface. A model or engine bearer is not app auth.
The browser principal `owner_browser` is dispatchable only while the host PIN
profile is enabled. Foreign or unknown resource ids are `NOT_FOUND` and are
looked up only inside projects the current principal may access.

## Capabilities

When available, `/v3/info` names only:

- `durable-conversations`
- `durable-runs`
- `command-receipts`
- `event-polling`
- `background-text-runs`
- `restart-uncertainty`

It does not advertise tools, approvals, migration, reconciliation resolution,
or multi-tenant operation. Info carries no user configuration.

## Admission and execution

Command replay uses `PlatformStore.lookupRunReceipt` and the store's canonical
digest before model or capacity checks. A changed payload is `COMMAND_CONFLICT`.
New work validates the registered model again before dispatch. Oversized JSON
(1 MiB) and prompts over 65,536 UTF-8 bytes fail before admission.

Defaults, overridable only inside the stated bounds:

| Knob | Env | Default | Bounds |
| --- | --- | --- | --- |
| Active runs | `A008_PLATFORM_MAX_ACTIVE_RUNS` | 4 | 1..32 |
| Nonterminal runs per project | `A008_PLATFORM_MAX_NONTERMINAL_PER_PROJECT` | 100 | 1..100 |
| Nonterminal runs on this backend | `A008_PLATFORM_MAX_NONTERMINAL` | 256 | 1..256 |
| Run lease | `A008_PLATFORM_LEASE_MS` | 30000 | 50..300000 |
| Lease renewal | `A008_PLATFORM_RENEW_MS` | 5000 | 10..60000, and less than the lease |
| Turn timeout | `A008_PLATFORM_TURN_TIMEOUT_MS` | 120000 | 50..120000 |
| Shutdown drain | `A008_PLATFORM_SHUTDOWN_DRAIN_MS` | 10000 | 0..120000 |
| Scan interval | `A008_PLATFORM_SCAN_MS` | 1000 | 10..60000 |
| Response bytes | `A008_PLATFORM_MAX_RESPONSE_BYTES` | 8388608 | 1..8388608 |

Replayed commands are not new admission. One nonterminal writer per
conversation remains the store's rule. Responses over the byte ceiling return
`CAPACITY_EXCEEDED` instead of a partial snapshot.

The coordinator scans registered projects on startup and on the scan interval.
Queued work whose principal is still authorized dispatches without that
observer staying connected. Disconnect does not cancel an accepted run.
Dispatch is recorded before the provider call. A committed assistant message is
preserved even when post-output memory fails; memory is recorded separately and
is not a reason to call the provider again. A dispatched turn with no committed
assistant stays unknown and becomes `needs_reconciliation` after lease recovery.
There is no public reconciliation mutation. Shutdown stops new dispatch before
aborting active turns and does not close project runtimes underneath those
callbacks.

Pending memory on an already committed answer is marked `unknown` at startup
and is not replayed.
