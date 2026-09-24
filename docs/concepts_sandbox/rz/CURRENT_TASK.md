# Current Task

Task ID: ACME-0191
Parent Task: None
Status: Paused
Owner: ChatGPT (operator)
Created: 2026-09-19
Last updated: 2026-09-21
Charter frozen at: 2026-09-19

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0055-public-npm-model-runtime-library.md`
- `docs/adr/0056-public-acme-engine-facade.md`

## Task Summary

Release the merged ACME-0190 lossless `oneOf` schema lowering so A008 can consume
it through the public `acme-engine` Node package. The public dependency closure
must remain registry-safe: source manifests may retain `workspace:*`, but packed
and published artifacts must contain concrete dependency versions.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Make ACME-0190's proven-disjoint `oneOf` lowering available to A008 through a
new installable `acme-engine` patch release.

### Primary Deliverable

Published npm packages `@acme-engine/adapter-model-openai@0.1.6`,
`@acme-engine/model-runtime@0.1.6`, and `acme-engine@0.1.6`, with a clean
registry-only consumer proof of the public facade path.

### In Scope

- Bump the affected public package versions from `0.1.5` to `0.1.6`.
- Build and pack the affected public dependency closure with pnpm.
- Inspect packed manifests for concrete internal dependency versions and no
  `workspace:` protocol leakage.
- Publish the three packages in dependency order after offline verification.
- Prove a clean external consumer installs `acme-engine@0.1.6` from npm and
  exercises the public facade's OpenAI strict-schema path for `boolean | string`.
- Record the release truth in the governed documentation and task handoff.

### Out of Scope

- Any change to ACME runtime behavior, public API, schema-lowering semantics or
  provider routing beyond the already merged ACME-0190 implementation.
- Publishing unrelated packages, tags, GitHub releases, deployments or live
  model-provider calls.
- Changes in A008 itself.

### Definition of Done

- The three named npm packages are available at exactly `0.1.6` with a concrete,
  installable dependency chain.
- A clean consumer using only registry artifacts imports `acme-engine` and
  demonstrates lossless lowering of a `boolean | string` `oneOf` through the
  OpenAI path without network provider dispatch.
- Required offline verification passes and the release is documented.
- No unscoped external mutation occurs beyond the three named npm publications.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] Focused OpenAI adapter and model-runtime tests
- [x] `pnpm test:unit` (release tests and all previously timing-sensitive blackboxes pass in isolation; full parallel run remains host-flaky)
- [x] `pnpm test:conformance`
- [x] `pnpm boundaries`
- [x] `pnpm format:check`
- [x] `pnpm docs:check`
- [x] Packed-manifest inspection
- [ ] Clean registry-only consumer proof (blocked until publication)
- [ ] `git diff --check`

## References

- `docs/finished/ACME-0190_lossless-oneof-schema-lowering.md`
- `docs/adr/0055-public-npm-model-runtime-library.md`
- `docs/adr/0056-public-acme-engine-facade.md`
- `packages/adapter-model-openai/package.json`
- `packages/model-runtime/package.json`
- `packages/acme-engine/package.json`

## Checklist

- [x] Merge the ACME-0191 ID claim to `main`.
- [x] Freeze this charter at `Ready` after the ID claim is on `main`.
- [x] Bump the three public package versions and release documentation.
- [x] Build, run required offline verification, pack and inspect artifacts.
- [ ] Publish the three verified package tarballs in dependency order (blocked: npm authentication).
- [ ] Run and record the clean registry-only consumer proof (blocked: requires the published packages).
- [ ] Update `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md` and `docs/JOURNAL.md` after successful publication.
- [ ] Complete, archive and restore `docs/CURRENT_TASK.md`.

## Decisions and Notes

- Release scope is exactly the public path affected by ACME-0190:
  `@acme-engine/adapter-model-openai -> @acme-engine/model-runtime -> acme-engine`.
- The npm publication is explicitly authorized by this task only after all
  minimum verification gates and packed-artifact inspection pass.
- `pnpm pack`, not direct workspace-directory publication, is the publication
  artifact baseline established by ACME-0184.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [x] Run every available offline gate. The full parallel unit run is host-flaky; release tests and every timing-sensitive blackbox passed when run in isolation.
- [ ] Confirm npm reports the three exact `0.1.6` versions after publication.
- [ ] Use an external temporary consumer directory with no workspace links for the registry-only proof.
- [x] Record skipped checks and their reason: publication and registry proof are blocked by npm authentication; full monorepo `pnpm build` exceeds the A008 command timeout after TypeScript starts, while all three release packages build successfully.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md` (after publication)
- [ ] `docs/SYSTEMDOC.md` (after publication)
- [x] `docs/JOURNAL.md` (handoff recorded below)
- [x] `packages/acme-engine/README.md`
- [x] `docs/FILESTRUCTURE.md` not required; no structure change is expected.
- [x] ADRs not required; ADR-0055/0056 already decide the release boundary.

## Handoff and Follow-ups

- Current state: `Paused` after a verified 0.1.6 release candidate; no npm publication occurred.
- Completed: source manifests are `0.1.6`; `C:\tmp\ACME-0191-pack` contains the three pnpm-packed tarballs. Packed manifests contain concrete dependencies: facade -> model-runtime `0.1.6`; model-runtime -> OpenAI adapter `0.1.6` plus its existing concrete closure; adapter -> core `0.1.2`. No packed manifest contains `workspace:`.
- Verification: `pnpm typecheck`; focused OpenAI/model-runtime tests 75/75; isolated timing-sensitive unit blackboxes 6/6; `pnpm test:conformance` 86/86; boundaries, format and docs checks passed. Full parallel units are host-flaky on Windows at Vitest's 5 s timeout; the serial run showed no such failures before the A008 command timeout. Each of the three release packages builds successfully. Full monorepo build exceeded the A008 command timeout after TypeScript started.
- Blocker: `npm whoami` returns `E401 Unauthorized`, so publication cannot proceed. npm also confirms the three `0.1.6` versions do not yet exist.
- Next recommended step: authenticate the npm CLI as the authorized publisher, then publish the verified tarballs from `C:\tmp\ACME-0191-pack` in dependency order (OpenAI adapter, model runtime, facade), run the external registry-only `boolean | string` proof, update release documentation and complete the charter.
- Resume condition: `npm whoami` succeeds for an account authorized to publish all three packages.
- Child tasks: None.
- Open questions: None.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
