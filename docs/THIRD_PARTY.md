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
| `pdfjs-dist` | 6.3.289 | Apache-2.0 | Mozilla's PDF reference implementation. Used for text-layer extraction only, imported lazily by `src/ingest/pdf-extractor.ts` so no other code path loads it. Authorised by the owner and recorded in ADR 0020 D11. |
| OpenHands Agent Canvas | `744e8652f254613045b779eb148bf4f741177975` | MIT | External integration evidence only; not copied and not an npm dependency. |
| Docs-First Continuity Protocol | `c1b7b44309095d30262d273d8f5d0704629a943c` | Apache-2.0 | Inspected local source for A008-0094 starter templates. Not copied wholesale. |
| Docs-First Multi-Agent Orchestrator Add-on | `7b57449935d93cfe1909c83b237367eab2d7bf5b` | Apache-2.0 | Inspected local source for A008-0094 policy shape. MCP server is not a runtime dependency. |

The root Apache-2.0 license applies only to A008-owned content. Dependency
packages retain their own terms and notices. A complete transitive audit and
distribution notice bundle remain release gates.

`@types/better-sqlite3` 9.6.0 is a development-only type package pinned by the
lockfile; it is not part of the runtime dependency inventory above.

`pdfjs-dist` declares an optional dependency on `@napi-rs/canvas` (MIT), a
native prebuilt binary npm installs alongside it. A008 never loads it:
rasterising a page is not extracting its text, and nothing in `src/` reaches
that code. It is recorded here because it lands in `node_modules` and would
otherwise be an unexplained native binary in an audit. `pdfjs-dist` also raised
this package's declared `engines.node` floor from `>=22.12.0` to `>=22.13.0`.

DOCX support deliberately adds no dependency. `src/ingest/zip.ts` and
`src/ingest/ooxml.ts` read the OOXML package using Node's own `zlib`; see
ADR 0020 D11 for why that trade was taken.
