# A008-0111 — Register and open existing projects

Task ID: A008-0111
Parent Task: None
Status: Ready
Owner: Codex (operator)
Created: 2026-09-15
Last updated: 2026-09-15
Charter frozen at: 2026-09-15; contract revision `2191a4b`

## Task Summary

The owner paused the ongoing client-API work after discovering that Projects can create new roots and reopen registered roots, but cannot adopt an already-existing project directory. Add that prerequisite without advancing A008-0103 stage 3.

## Task Charter

### Goal

Let the standalone Projects surface register an existing local project root and open it through the same shared runtime/project ownership used by other registered projects.

### Primary Deliverable

A host-owned `Add existing project` flow: typed v1 request/response contract, registry service, route, GUI form, workspace switch and verification. The selected project directory is never mutated by registration.

### In Scope

- Project name, existing absolute root folder and explicit global-memory choice.
- Validate that root exists and is a directory; reject roots already registered.
- Generate one canonical A008 project ID; no user-supplied identity.
- Register outside the project tree, then switch workspace through the existing binding/applyWorkspace path.
- Add `POST /v1/projects/register` as an additive v1 route and update the shared protocol/OpenAPI inventory.
- Add a distinct `Add existing` GUI mode beside `New project` and `Recent`.
- Preserve the existing project tree byte-for-byte; no Git init, docs generation, worker-root creation or migration.
- Make memory namespace semantics explicit: registration does not heuristically merge legacy/unregistered memory.

### Out of Scope

- A008-0103 V2 business/session implementation or stage progression.
- Importing/copying/moving repositories, Git remotes or files.
- Automatic legacy-memory migration or namespace guessing.
- Editing an already-registered project's metadata.
- OS-native folder picker, project deletion, rename or archive.
- Provider calls, deployment or publication.

### Definition of Done

- Existing non-empty directories can be registered and opened from Projects.
- Registration writes only the A008 registry; selected project content is unchanged.
- Duplicate/nonexistent/non-directory/relative roots fail with clear errors.
- Registered project receives a canonical project ID and selected memory setting.
- Current v1 contract package and generated OpenAPI describe the additive route.
- Focused core/host/GUI tests, full test gate, protocol verification and GUI build pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `2191a4b`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Existing-project registration | PC-01/04/06; ADR 0039 generated project identity/workspace switch; ADR 0041 explicit project binding; owner direction 2026-09-15 recorded by ADR 0042 | Existing repositories cannot enter the registered project/runtime path without being falsely treated as new/empty bootstrap targets; the paused work lacks the project binding the owner needs. | One register service + additive host route + small GUI mode using the existing registry and workspace switch. | Existing non-empty fixture remains byte-identical while registry/binding are created and usable. |
| Host-only filesystem inspection | PC-05; ADR 0039 renderer never mutates project filesystem | A renderer-side adoption path would bypass the established filesystem owner. | Renderer sends JSON; host validates existing absolute directory and writes only registry state. | GUI source has no Node FS import; route tests assert root content unchanged. |
| Explicit memory semantics | PC-04; ADR 0041 no heuristic copy/merge/empty replacement | Guessing a legacy namespace could bind wrong knowledge; silently claiming migration would be false. | Allocate normal registered project identity and state clearly that no legacy-memory migration occurs. | Tests verify selected memory flag/project ID and no legacy attachment side effects. |
| Additive v1 contract | PC-01/06; ADR 0040 v1 compatibility obligation; HOST_PROTOCOL stability rule | GUI-only hidden route would reintroduce client coupling and drift from shared contracts. | Add one typed operation to protocol route/schema/OpenAPI inventories without altering existing routes. | Protocol schema generation/verification and HTTP contract coverage pass. |

### Minimum Verification Gates

- [ ] Existing non-empty directory registers without any project-tree writes.
- [ ] Duplicate, missing, file and relative roots fail closed.
- [ ] Host route applies the registered workspace and returns shared schema output.
- [ ] GUI exposes New / Add existing / Recent and uses host JSON only.
- [ ] Shared v1 route/schema/OpenAPI artifacts are regenerated and verified.
- [ ] Full `npm test`, GUI production build and `git diff --check` pass.

## Checklist

- [x] Claim A008-0111 on main and freeze bounded charter.
- [ ] Record ADR 0042.
- [ ] Implement protocol + registry/service + host route.
- [ ] Implement GUI Add existing flow.
- [ ] Run focused and full verification; update owning docs.
- [ ] Archive, handoff and restore CURRENT_TASK before final commit.
