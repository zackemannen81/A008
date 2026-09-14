# A008-0110 - V2 authentication foundation

Task ID: A008-0110
Parent Task: A008-0103
Status: Ready
Owner: Codex (operator)
Created: 2026-09-15
Charter frozen at: 2026-09-15

## Frozen charter
Goal: establish explicit V2 principal/project/capability authorization and local
device registration before V2 session/business operations are exposed.
Deliverable: shared auth/discovery/error schemas, local grant/list/revoke CLI,
hashed expiring device registry and host discovery/one-use ticket endpoints.
Scope: additive /v2/info and POST /v2/auth/ticket; existing configured PIN owner
profile, device Bearer authentication, project allow-list/capabilities, expiry,
revocation on read, bounded one-use ticket store and current Origin policy.
Device registry persists hashes/metadata outside the repository using existing
SQLite dependency; no raw credential persistence. Default grant expiry 30 days.
Out of scope: V2 WebSocket/business dispatch, live socket revocation, session
resume/receipts and SDK/native UI. These depend on this foundation and must be
verified by later children before stage 3 is complete. V1/panels remain unchanged.

## Necessity Gate
Contract: PROJECT_BRIEF at 8f0dda0; PC-05 credential/execution boundaries, PC-01
shared owner; ADR 0041 decisions 4,6,7 and CLIENT_API_V2 authentication section.
An independent client needs an app credential distinct from provider secrets,
with project/capability scope and revocation. Existing PIN/no-PIN V1 handling
cannot grant anonymous V2 authority. Smallest approach: reuse crypto/SQLite and
current PIN/Origin gates, explicit owner-local grants and short-lived tickets;
no external identity service or credential in URLs. Cap outstanding tickets per
principal to prevent authenticated allocation from exhausting host memory.
Verify actual CLI and host requests, hashed persistence, restart/expiry/revoke,
wrong scopes/projects, Origin refusal, missing-PIN denial and ticket reuse/expiry.

## Definition of done / gates
- Shared installed schemas describe discovery/auth/errors without runtime imports.
- Grant returns a random 32-byte credential once; list/storage contain no secret.
- Device projects/capabilities/expiry are enforced per auth/ticket operation;
  revoked/expired/reused tickets fail, and absent PIN never means V2 anonymous.
- Tickets require an existing authorized project and validated optional session;
  unsupported session validation fails closed until session ownership is wired.
- Real host and CLI tests, full tests, builds, installed package and portable
  engine proof pass; no paid calls, credential logging or user-data mutation.
- Docs/necessity review/archive/handoff/frozen plan/template checks pass; push,
  PR, merge and operator journal under standing owner authority.

## Mutable progress
- [ ] Implement schemas, credentials, tickets and local CLI.
- [ ] Integrate and verify host discovery/ticket endpoints.
- [ ] Complete documentation, archive/template and authorized integration.
