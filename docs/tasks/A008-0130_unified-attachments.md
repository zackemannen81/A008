# A008-0130 — unified prompt attachments

Task ID: A008-0130
Parent Task: A008-0124
Status: In Progress
Owner: ChatGPT (operator)
Created: 2026-09-18
Last updated: 2026-09-18
Charter frozen at: 2026-09-18; task identity claim merged in `c5b04c5`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/adr/0020-source-upload-ingest.md`
- `docs/adr/0044-native-vision-input.md`

## Task Summary

Native image input already exists end-to-end once the composer owns a validated source locator, but the current product GUI does not provide one consistent acquisition experience. A008-0130 unifies clipboard paste, file picker, drag/drop and an explicit local filepath into the existing source-store/locator pipeline.

## Task Charter

### Goal

Let the user acquire one invocation-local native image attachment from clipboard, file picker, drag/drop or an explicit local filesystem path without creating a second attachment/storage/provider path.

### Primary Deliverable

The product composer exposes four image-acquisition routes that all resolve to the existing bounded `PromptImageAttachment { locator, mediaType }` representation before normal ACP/native-vision dispatch.

### In Scope

- Clipboard image paste into the composer.
- File-picker image attachment through the existing upload route.
- Drag/drop image attachment onto the composer.
- Explicit absolute local filepath import owned by the GUI host and stored through the same content-addressed source store.
- Reuse the existing `POST /v1/upload` host boundary; local-path import is an additive request mode on that endpoint, not a second blob store.
- Keep one active attachment slot, replacing the previous attachment when another is acquired.
- Small composer affordance for entering a local path and clear attachment/error state.
- Regression coverage for all acquisition modes and host path import.

### Out of Scope

- Multiple simultaneous prompt attachments.
- Native PDF/DOCX/text-file model attachments.
- V2/SDK attachment transport.
- OCR, automatic image memory ingest or image-to-memory extraction.
- Provider/model fallback or auto-switching.
- Changes to ACME, direct provider multimodal mapping or durable chat representation.

### Definition of Done

- Pasting an image attaches it through the existing upload/source locator flow.
- Picking or dropping a supported image attaches it through the same flow.
- Supplying an absolute local image path causes the host to read it under the existing upload byte cap, sniff its real media type, write the same content-addressed store and return the same `UploadedSource` shape.
- Unsupported/non-image inputs fail explicitly without dispatching a model call.
- Normal prompt send continues to carry only the bounded attachment descriptor and committed chat remains text-only.
- Existing model capability gating remains authoritative.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-06 — Supported user controls and content.
Contract revision: `c5b04c5`
Accepted constraint: ADR 0044 D2 reuses the existing upload/source boundary and keeps only bounded attachment metadata in the composer; ADR 0044 D1/D5 keep chat history and durable memory text/provenance semantics unchanged.

| Change                    | Clause and constraint                     | Outcome; consequence if omitted                                                         | Smallest sufficient change                                                           | Planned check                                           |
| ------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Unified image acquisition | PC-06 + ADR 0044 D2                       | Native vision exists but ordinary clipboard/path workflows cannot reach it consistently | route all acquisition modes to one active locator-backed attachment                  | focused GUI/upload/host regressions                     |
| Local filepath import     | PC-06 + ADR 0044 D2 + PC-05 host boundary | Browser cannot safely read an arbitrary typed host path                                 | host-owned additive mode on existing `POST /v1/upload`, same byte cap/store/sniffing | host route regression + containment/source-store checks |

### Minimum Verification Gates

- [ ] Composer paste regression.
- [ ] Composer picker regression.
- [ ] Composer drag/drop regression.
- [ ] Local-path upload client regression.
- [ ] GUI-host absolute-path import regression including size/type failure.
- [ ] Existing native-vision prompt regression remains green.
- [ ] GUI typecheck/build and diff check.
- [ ] Owner manual smoke: paste, picker/path and live image prompt.

## Checklist

- [x] Claim task id.
- [x] Freeze charter.
- [x] Add host local-path upload mode.
- [x] Add renderer upload-path client.
- [x] Add paste/drop/path composer UX.
- [x] Add regressions.
- [ ] Owner verification.
- [ ] Archive/handoff.

## Decisions and Notes

- One active attachment is intentionally retained. A new acquisition replaces the old one.
- Local path must be absolute and point to a regular file. The host, not the renderer, reads it.
- The actual media type is sniffed from bytes; filename/extension never grants image capability.
- No live provider call is authorized by this task.

## Charter Amendment Log

- none

## Verification

- Root TypeScript typecheck passed after implementation.
- GUI TypeScript typecheck passed after implementation.
- `git diff --check` passed.
- No automated test suite was run through Remote Desktop Commander; owner will run focused/full tests locally.
- No live provider call was made.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md` — operator merge record pending.

## Handoff and Follow-ups

- Current state: implementation complete; owner verification pending.
- Next recommended step: owner runs focused GUI/upload/host tests and manual paste/file/drop/path smoke.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none.
