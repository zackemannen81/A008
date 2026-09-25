# ADR 0042 — Existing project registration

Status: Accepted
Date: 2026-09-15
Task: A008-0111
Amends: ADR 0039 project bootstrap; compatible with ADR 0041 project ownership

## Context

The owner requires Projects to adopt an already-existing local project and root folder before continuing the paused client-API implementation. ADR 0039 currently covers creating a new root and reopening roots already present in A008's registry; its bootstrap path deliberately rejects non-empty unexpected directories.

Treating an existing project as a bootstrap target would conflate registration with filesystem creation and could mutate a repository the user only intended to attach.

## Decision

A008 adds a separate existing-project registration operation. The user supplies a display name, an existing absolute project root and whether the project uses the global A008 memory store. The host canonicalizes and validates the directory, generates the project identity and writes the registration outside the project tree.

Registration performs no project-tree mutation: no directory creation inside the project, no Git init, no Docs-First files, no multi-agent policy, no worker roots and no content rewrite. After successful registration the existing workspace-switch path opens the project through the shared runtime owner.

The v1 surface adds `POST /v1/projects/register`. This is additive: existing bootstrap/open/list behavior and payloads do not change. The shared protocol package owns the new request schema and route/OpenAPI inventory so the bundled GUI does not gain a private host contract.

A root already registered is refused with a named error and should be opened from Recent instead of acquiring a second identity. Display names need not be globally unique; canonical root ownership is the uniqueness boundary.

## Memory

A newly registered existing folder receives a normal generated registered-project identity. Selecting global A008 memory uses that identity as its namespace in the existing global store. Registration does not guess, merge or migrate any legacy/unregistered namespace. That limitation is explicit in the GUI and documentation; exact legacy attachment remains the separate strict mechanism described by ADR 0041.

## Stored metadata

The existing `RegisteredProject` shape is retained for v1 compatibility. For adoption, `repository.initialize` is false because A008 did not initialize Git; repository name defaults from the canonical root. Docs-First may be observed from the existing standard marker files, but registration never creates or repairs them. Multi-agent configuration is not inferred because its worker-root/limits cannot be safely reconstructed from arbitrary project content.

## Consequences

Existing repositories can enter A008's registered project list and shared runtime ownership without being rewritten. The project registry becomes the only durable mutation of the adoption operation. Future V2/SDK project registration can reuse this semantic boundary instead of treating bootstrap as import.
