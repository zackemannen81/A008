# Platform admin CLI

Local inspection and cancellation for one opted-in platform host. It is not an
admin console, a second credential store, or a reconciliation tool.

`npm run platform-admin` runs `src/platform/admin-cli.ts`. The script does not
load `.env.local`. Origin comes from `--origin` or `A008_PLATFORM_ORIGIN`. The
device token comes only from `A008_DEVICE_TOKEN`. There is no credential flag,
URL userinfo, query credential, or prompt argument.

| Command | Required | Auth |
| --- | --- | --- |
| `info` | origin | none |
| `list-conversations --project ID` | origin | bearer once |
| `get-run --run ID` | origin | bearer once |
| `cancel-run --run ID --expected-revision N` | origin | bearer once |

`info` prints only `available` and the capability names returned by the host.
It does not print configuration, and it does not send the device token.
`available: false` is still a successful info response.

The other commands call `createPlatformV3Client` once. `cancel-run` performs
one cancel request. A lost response or a failed second invocation is not
retried. There is no reconcile, import, grant, revoke, or backup command.

Success prints the SDK payload as one JSON object. Failure prints
`{"code","message"}` on stderr and exits non-zero. `code` is the SDK error
code (`UNAUTHENTICATED`, `NOT_FOUND`, `TRANSPORT_ERROR`, `REVISION_CONFLICT`,
and the other client codes). The process does not open a platform database.
Device credentials stay in the existing device registry used by the host.
