# Third-party dependencies

This is the tracked provenance and license inventory for direct runtime
dependencies. Exact artifacts and integrity hashes are fixed in
`package-lock.json`. Development-only packages remain represented by the lockfile
and must be reviewed before distribution.

| Package/source | Pinned version/revision | License | Use |
| --- | --- | --- | --- |
| `@agentclientprotocol/sdk` | 1.4.0 | Apache-2.0 | Official stable ACP v1 types, validation, JSON-RPC, and stdio stream implementation. |
| `zod` | 4.5.4 | MIT | Required runtime peer for ACP schema validation. |
| `better-sqlite3` | 13.0.3 | MIT | Synchronous SQLite runtime used by the explicitly configured local semantic-memory repository and retrieval index. |
| OpenHands Agent Canvas | `744e8652f254613045b779eb148bf4f741177975` | MIT | External integration evidence only; not copied and not an npm dependency. |

The root Apache-2.0 license applies only to a007-owned content. Dependency
packages retain their own terms and notices. A complete transitive audit and
distribution notice bundle remain release gates.

`@types/better-sqlite3` 9.6.0 is a development-only type package pinned by the
lockfile; it is not part of the runtime dependency inventory above.
