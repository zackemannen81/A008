# Legacy credential remediation

Status: Completed

## Discovery context

Read-only bootstrap inspection found a hard-coded NVIDIA credential in the raw
legacy client. The value is deliberately not repeated here.

## Proposed outcome

- Owner revokes or rotates the exposed credential outside this repository.
- A bounded intake extracts model registry, payload, streaming, validation, and
  error behavior into secret-free source contracts.
- Provider credentials are accepted only from environment or a reviewed secret
  provider.
- Raw dependencies, generated output, unrelated media, and the monolithic
  script are not imported wholesale.

## Why it is not active

A008-0001 only establishes repository state and may not modify product or raw
provenance code. Revocation also requires provider-account authority.

## Dependencies

- Credential owner access to NVIDIA account/key management.
- Provenance and ownership review of legacy source.

## Suggested verification

- Secret scan of Git history, index, and worktree scope.
- Unit tests with fake HTTP for payloads, SSE, tool-call chunks, rollback, and
  error/fallback classification.
- Negative test proving startup fails clearly without `NVIDIA_API_KEY`.
- Separate explicitly authorized live smoke test only after rotation.

## Resolution

The owner reported the exposed key revoked and rotated on 2026-09-01. A008-0003
implemented environment-only credential composition, the provider-neutral core,
NVIDIA adapter, fake HTTP/SSE coverage, and missing-key failure before transport
construction. Live provider validation remains separately authorized work.
