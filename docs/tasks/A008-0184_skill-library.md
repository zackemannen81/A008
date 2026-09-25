# A008-0184 — Skill library, install and session selection

Task ID: A008-0184
Parent Task: None
Status: Ready
Owner: Rickard (operator)
Created: 2026-09-25
Last updated: 2026-09-25
Charter frozen at: 2026-09-25

## Task Summary

The operator needs a local skill library where a chat operator can search an external skill catalog, explicitly install or remove skills, and select installed skills at the message composer.

## Task Charter

### Goal

Provide a local, operator-controlled AI skill library with searchable discovery, explicit install/removal, and per-message skill selection.

### Primary Deliverable

An authenticated GUI-host skill-library API and GUI surface backed by one local catalog, using the public `anthropics/skills` GitHub repository as the bounded discovery source.

### In Scope

- Fetch and search the public bounded source catalog on explicit operator request.
- Validate and persist installed skill metadata and bounded `SKILL.md` instruction text locally.
- List and explicitly remove installed skills.
- Allow selecting one installed skill at the composer and include its stored instruction text in that submitted chat request.
- Document the authority, persistence, external-data and execution boundaries.

### Out of Scope

- Executing skill scripts, installing dependencies, or granting tools/MCP/filesystem/network authority.
- Automatic refresh, automatic install, RSS/general-web crawling, ratings, accounts, sync or marketplace payments.
- Changing model, provider, semantic-memory, session or tool-approval ownership.
- Installing from arbitrary repository URLs.

### Definition of Done

- The operator can explicitly refresh/search the fixed public catalog, install a listed skill, select it in the composer, submit it with one chat request, and remove it from the local library.
- Network discovery is bounded to the fixed source; no remote catalog is persisted as authority.
- Imported text has explicit size/shape validation and is never executed.
- Host, GUI and persistence behavior have focused tests and required documentation updates.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: current `main` at claim time

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Local installed-skill catalog | PC-LF-01, PC-LF-07; persistent state remains local and authoritative | Operators need a retained library; without it install/remove state disappears or depends on a hosted service | Add one validated local catalog field and host owner | Unit tests for parse, add, remove and reload |
| Explicit remote discovery | PC-LF-01, PC-LF-02; external sources are optional capability, not local owner | Operators need searchable skill discovery; without it they must manually discover every skill | Explicit request to fixed public `anthropics/skills` source through the GUI host | Host route tests with mocked fetch and source/shape rejection |
| Composer skill selection | PC-LF-01; existing local chat/session path remains owner | Operators need to use a chosen installed skill; without it library content cannot affect a turn | One selected installed skill appended as bounded request data for that prompt only | Composer/submit tests assert selected instruction reaches exactly one request |
| Execution boundary | PC-LF-01, PC-LF-03, PC-LF-04; no new tool or execution authority | Remote skill text must not execute scripts or alter system ownership | Store markdown instruction text only; no script fetch/launch or authority mutation | Source review and route tests |

### Minimum Verification Gates

- [ ] Root typecheck passes.
- [ ] GUI typecheck passes.
- [ ] Focused host/catalog and GUI skill tests pass.
- [ ] `git diff --check` passes.
- [ ] No live model/provider call; external catalog tests use fixtures.

### Verification Budget

- Live verification purpose / required provider behavior: not needed; remote catalog behavior is mocked.
- Budget owner / parent allocation: A008-0184.
- Policy revision / inherited or explicit approved limits: not needed.
- max_live_verification_cost (amount + currency): 0 SEK.
- max_live_verification_calls (all physical attempts): 0.
- max_input_tokens_per_call / max_output_tokens_per_call: 0 / 0.
- live_call_timeout_seconds: 0.
- Approved provider/model routes / credential-source references: none.
- Price reference and checked-at / billing units / currency conversion / allowance: not applicable.
- Observed spend / outstanding reservations / unknown cost / attempts / remaining allowance: 0 / 0 / 0 / 0 / 0.
- Worker allocations or serialized dispatch; resume retains prior usage: no dispatch.

## References

- `docs/PROJECT_BRIEF.md` PC-LF-01, PC-LF-02, PC-LF-03, PC-LF-04, PC-LF-07.
- `src/core/user-catalog.ts` local catalog owner.
- `src/gui-host/server.ts` authenticated GUI-host route owner.

## Checklist

- [ ] Add and validate local installed-skill catalog data.
- [ ] Implement fixed-source discovery/import/removal host routes with tests.
- [ ] Add GUI library and composer selection surfaces with tests.
- [ ] Update system/status/file map documentation.
- [ ] Run verification gates and complete handoff/archive.

## Decisions and Notes

- Fixed source is `https://github.com/anthropics/skills`; discovery text is untrusted data.
- A selected skill affects one submitted prompt only. It is not persistent global instruction state.

## Charter Amendment Log

- none

## Verification

- [ ] Pending implementation.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes

## Handoff and Follow-ups

- Current state: Ready.
- Next recommended step: implement the frozen deliverable.
- Blockers: none.
- Child tasks: none.
- Resume condition: repository state and this record.
- Open questions: none.
