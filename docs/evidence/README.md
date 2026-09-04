# Verification Evidence

Discoverability: index. Every member is listed below.
Member state: required. Every record names its task and evidence boundary.

Evidence records are durable, non-secret summaries of completed verification.
Binary artifacts are listed beside their owning record. Runtime state, raw logs,
credentials, and private source material do not belong in this collection.

## Records

- [`A008-0005_agent-canvas-runtime-proof.md`](A008-0005_agent-canvas-runtime-proof.md)
  with [`A008-0005_agent-canvas-chat.png`](A008-0005_agent-canvas-chat.png) —
  completed local Canvas -> Agent Server -> A008 ACP -> loopback proof.
- [`A008-0030_gui-runtime-proof.md`](A008-0030_gui-runtime-proof.md) —
  completed A008 GUI host -> A008-acp -> local memory runtime -> loopback
  proof, including the credential-boundary check on the observed wire.
- [`A008-0041_upload-ingest-proof.md`](A008-0041_upload-ingest-proof.md) —
  completed GUI host -> A008-acp -> extraction -> evidence upload proof, with
  the credential boundary and the honest-failure path for an unsupported type.
- [`A008-0056_document-extraction-proof.md`](A008-0056_document-extraction-proof.md) —
  completed PDF and Word extraction through the same upload chain, with the
  OOXML family check, sixteen of the owner's own documents read, and the two
  mutations that survived and turned out to be findings.
