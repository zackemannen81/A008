# Current Task

Task ID: A008-0157
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-22
Last updated: 2026-09-22
Charter frozen at: 2026-09-22, after main allocation e867525 and necessity review

## Read First

AGENTS, TASK_WORKFLOW, PROJECT_BRIEF, CONTRIBUTING, CURRENT_STATUS, SYSTEMDOC,
CURRENT_MEMORY_MODEL, JOURNAL, FILESTRUCTURE; platform draft, MULTIAGENT,
ADR 0041/0043/0047 and read-only reference repositories.

## Task Summary

The owner requests an updated A008 Platform proposal integrating the four
Docs-First add-ons and their established multi-agent working method. The owner
explicitly corrects earlier advice to repeat a conceptual two-worker proof.
This task productizes that experience in the design; it does not implement it.

## Task Charter

### Goal

Make the platform proposal coherent with established Docs-First multi-agent
work, bounded context and communication, continuity and independent add-ons.

### Primary Deliverable

Updated `docs/A008_PLATFORM_SPEC.md`, version 1.0 review proposal.

### In Scope

- Read-only comparison with the owner's named source repositories and add-ons.
- Integrate ownership, identities, workspaces, context, communication, recovery,
  policy, economics, API/UI, migration and implementation acceptance.
- Replace exploratory swarm gates with bounded product integration deliverables.
- Update documentation navigation/status; verify, archive and hand off.

### Out of Scope

- Product code, dependencies, generated contracts or deployment.
- Changes to external repositories, workers or accepted A008 ADRs.
- Spawning workers, creating clones, installing/launching a supervisor, merging,
  pushing, publication, live providers or paid execution.
- A new proof programme to establish the value of the existing working method.

### Definition of Done

- One complete proposal integrates all four add-on boundaries.
- Evidence distinguishes established practice, shipped source surfaces,
  proposed modules and A008-specific integration gaps.
- Need-to-know applies to master/workers with expansion and authority tracking.
- Repo authority, canonical platform state, semantic memory and ACME execution
  each have one explicit owner.
- Roadmap targets integration; acceptance tests new code, not the method's value.
- Document checks pass; archive/handoff exist and current-task template is restored.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: ab52af16b658ed61427b24c2333b2fa9fa51b3b5

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Update platform proposal for existing multi-agent practice | PC-01 shared owners; PC-03 additive/bounded context; PC-04 runtime authority; PC-05 explicit execution; PC-06 controls; ADR 0043 A008 orchestration; MULTIAGENT and CURRENT_MEMORY_MODEL | Resolve task/run/context/communication ownership before platform contracts freeze; otherwise duplicated owners and unnecessary methodology proofs remain | Update existing proposal plus status/navigation with pinned read-only evidence; no implementation adoption | Four-module coverage, authority/source review, integration roadmap, failure/security/context scenarios, Markdown checks |

### Minimum Verification Gates

- [x] Reference and current-versus-target review.
- [x] Four-module, ownership and established-practice coverage review.
- [x] Link/fence/JSON/requirement/acceptance-ID checks.
- [x] Diff/secret/scope review and git diff --check.
- [x] Archive/handoff/indexes prepared; exact template restoration closes the task.

## References

- A008 baseline: d91f010.
- Protocol: 0341b1069aa9183d588a87acd72c72b5b71d8f16.
- Multi-agent add-on: 7b57449935d93cfe1909c83b237367eab2d7bf5b.
- ACME HEAD: 9d8e96579dda23b46a1e65dd452b15deb1251709; checkout has
  unrelated uncommitted package/docs changes; HEAD alone does not pin those.
- A008 lockfile and installed facade/model-runtime both resolve 0.1.6.
- Owner's four design documents and original Controller paper are design input,
  not automatically adopted instructions.

## Checklist

- [x] Read authority and inspect reference repositories without mutation.
- [x] Allocate on main and freeze documentation-only scope.
- [x] Update proposal and roadmap.
- [x] Verify and prepare documentation handoff.

## Decisions and Notes

- Missing supplied protocol path resolved to C:/code/docs-first_continuity-protocol.
- Supervisor source/field notes support reuse of established work; they do not
  establish that all four modules already ship in A008.
- Future acceptance tests verify the integration, not a new methodology proof.
- Hash comparison confirms all four source-repository add-on documents are
  byte-identical to the owner's previously reviewed attached Markdown files.
- Profile integration may begin locally over P1's run/target boundaries before
  the remote two-client milestone; no additional methodology pilot is required.
- New code must still demonstrate its own isolation, concurrency and recovery
  behavior. Prior experience does not imply unimplemented platform guarantees.

## Charter Amendment Log

- none

## Verification

- Node document checks pass: 28 sequential top-level sections, 16 unique PL
  requirements covered by 33 unique acceptance scenarios, 16 decision IDs,
  14 resolving local Markdown links, matching table columns, balanced fences
  and one valid JSON example. Two Mermaid diagrams reviewed as text only.
- Read-only source review covers protocol CURRENT_STATUS, add-on suite/field
  notes, supervisor source, ACME facade/model-runtime source and A008 lockfile.
  Installed facade/runtime version 0.1.6 verified locally; no fresh registry
  publication or external package conformance claim made.
- Reviewed invariant transitions: repo task versus run completion, explicit
  authority adoption, projection versus actual observed inputs, inbox delivery
  versus acceptance, worker/master replacement, fencing, shared reservations,
  process opacity, advisory versus enforced rules and protected runtime evidence.
- Diff necessity review passes: documentation proposal plus status/navigation.
  Accepted API/ACME/memory semantics, product source and dependencies unchanged.
- Scope/secret review and git diff --check pass. No private payloads or secrets
  introduced. External repositories remain untouched; ACME's pre-existing
  dirty paths are unchanged, other source repositories remain clean.
- Runtime suites/builds, source-server execution, new pilots, live providers,
  push and publication skipped: this task changes Markdown only.

## Documentation Updates

Platform proposal, CURRENT_STATUS, FILESTRUCTURE, archive/handoff and indexes.
SYSTEMDOC and accepted contracts remain unchanged: no new behavior ships.
JOURNAL belongs to the operator on integration to main.

## Handoff and Follow-ups

Next: bounded product integration against this proposal.
No implementation, push or deployment authorized by this task.
Archive: `docs/finished/A008-0157_platform-multiagent-specification.md`.
Handoff: `docs/handoffs/A008-0157.md`.
Restore CURRENT_TASK from its exact template before final commit.
