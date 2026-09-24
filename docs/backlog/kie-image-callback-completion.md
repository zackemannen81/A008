# Kie image callback completion

Status: Open
Source: owner review of current Kie image generation path
Recorded: 2026-09-20

## Context

A008 currently generates Kie images through `KieJobTransport`. It submits
`POST /api/v1/jobs/createTask`, receives a `taskId`, then polls
`GET /api/v1/jobs/recordInfo?taskId=...` every two seconds until success,
failure, or the 180-second timeout.

This works and is covered by tests, but it keeps A008 responsible for repeated
status requests while the provider is already capable of delivering an async
completion callback.

The current image path is owned directly by A008:
`GUI -> handleImageGenerate() -> KieJobTransport -> kie.ai`. ACME is not in
this media-generation path and this proposal does not move that ownership.

## Outcome sought

Replace normal Kie image-result polling with a provider callback/webhook flow.
A008 should submit the job with an A008-owned callback URL, correlate the
callback to the expected job, fetch and validate the completed result, persist
the generated image into the existing source store, and resolve the originating
image operation without duplicate side effects.


## Required boundaries

- Keep A008 as the owner of Kie image generation and source-store persistence.
- Do not route Kie image jobs through ACME as part of this change.
- Treat callback payloads as untrusted provider input and validate job identity,
  expected provider/model, terminal state, and result shape before persistence.
- Make duplicate callback delivery idempotent.
- Never accept a callback as authority for an unknown or expired job.
- Preserve explicit timeout/failure behavior when no valid callback arrives.
- Do not depend on temporary Kie media URLs after the local source-store copy is
  committed.
- Do not weaken Stage-4 client/session guarantees or conflate provider-job
  identity with `commandId`, `turnId`, `sessionId`, or ACME execution IDs.

## Open questions before activation

1. Which public/local callback surface can Kie reach in each supported A008
   deployment mode?
2. What authentication or provider-origin verification can be applied to Kie
   callbacks beyond possession of an unguessable job correlation token?
3. Should polling remain as an explicit compatibility fallback when callbacks
   cannot be delivered, or should callback-capable deployment be required?
4. Where should short-lived pending-job state live, and what uncertainty is
   surfaced if A008 restarts after submission but before callback delivery?
5. What bounded retention and cleanup rules apply to completed, failed, timed
   out, and orphaned provider jobs?

## Suggested verification

A fake Kie job should prove submit -> callback -> result download -> one local
source-store commit with zero `recordInfo` polling on the normal path.
Duplicate callbacks must not duplicate downloads or persistence. Unknown,
malformed, mismatched and late callbacks must fail closed. Missing callback
must terminate according to the chosen timeout/fallback policy. Restart
behavior must be documented and tested explicitly rather than inferred.

## Dependencies

No current blocker. Activation should happen as its own bounded task after the
callback reachability and restart-uncertainty policy are chosen.
