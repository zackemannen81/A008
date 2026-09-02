# ADR 0002 — License and source boundaries

Status: Accepted

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

The bootstrap input declares Apache-2.0 for a007. Candidate source material has
separate provenance: OpenHands Agent Canvas is MIT, while raw legacy material
has no reviewed repository license boundary and contains a credential. The
memory-engine has not been created and has no source baseline to import.

## Decision

- a007-owned repository content uses Apache License 2.0.
- Third-party code is imported only by a task that pins its source revision,
  records its license, preserves required notices, and audits the bounded
  dependency surface.
- MIT-licensed OpenHands code may be adapted only with its copyright and license
  notice preserved in copies or substantial portions.
- Related prior-work repositories are not dependencies. Reuse of any bounded
  part would require a separate owner decision, pinned source, and license review.
- Raw legacy material remains ignored local provenance until sanitized and its
  ownership/provenance are reviewed.

## Consequences

- The root Apache license does not erase third-party terms.
- Dependency and transitive-license review becomes a gate before packaging.
- The legacy directory cannot be added wholesale to Git.
- No statement in this decision authorizes publication or a release.
