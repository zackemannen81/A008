# Task A008-0049 — Source knowledge extraction

Status: Ready
Owner: Operator
Parent: A008-0041 (wave 2)
Created: 2026-09-03
Charter frozen at: 2026-09-03
Branch: `claude/A008-0049-source-knowledge-extraction`

## Why now

ADR 0020 D7 deferred this on two grounds. One of them no longer holds.

D7 said the analyzer instruction "is written for one [dialogue pair]". A008-0047
replaced it with the owner's version, which says *"Extract every distinct
durable and reusable knowledge claim explicitly stated or directly entailed by
**the source**"*. It no longer mentions a message or an answer, and it now asks
for completeness and recursive splitting — which is what document text needs.

What remains of D7 is the staging shape: `StagePostOutputKnowledgeInput` is
`{ taskId, message, answer, applicabilityScopes }`, and an uploaded document is
neither a message nor an answer.

## Goal

An ingested source can be run through the analyze/classify/commit coordinator,
without pretending it is a conversation turn.

## In scope

- `src/orchestration/post-output-knowledge-intake.ts` — `PostOutputAnalyzerInput`
  and `StagePostOutputKnowledgeInput` become discriminated unions over a
  dialogue turn and an ingested source.
- `src/orchestration/semantic-json-model.ts` — the model-backed analyzer
  serializes each variant under its own field names.
- `src/runtime/local-memory-runtime.ts` — `ingestSource` gains an opt-in
  `extractKnowledge` and, when set, runs the coordinator and reports counts.
- `src/acp/A008-acp-agent.ts`, `src/acp/server.ts` — carry the option and the
  counts through `_a008/source/ingest`.
- Tests in the existing files plus `test/runtime-source-ingest.test.ts`.

## Out of scope

- Chunking. One source is still one `Utterance`; passage-level citation remains
  the open question in `docs/backlog/document-ingest-granularity.md`.
- `src/gui-host/` and `gui/`. Surfacing the option and the counts in the upload
  route and the renderer is a separate task.
- Any change to the analyzer instruction or the staging ceiling.
- Any live provider call.

## Decisions this task freezes

**A source is its own analyzer variant, not a message or an answer.** The
serialized payload is what the model reads as untrusted data. Labelling a
document as `message` or `answer` would put a false frame in that payload, and
the instruction already speaks of "the source".

**`extractKnowledge` defaults to off.** The coordinator commits proposals
strictly sequentially with one classifier call each, and A008-0046 raised the
ceiling to 128. Running that inside an upload would block the caller for
minutes. Off by default keeps ingest fast; turning it on is a deliberate,
costed choice.

## Definition of done

- A source can be staged and committed without a `message` or an `answer`
  anywhere in the path.
- `ingestSource` without the option behaves exactly as it does today.
- With the option, the returned outcome reports proposals staged and committed.
- The dialogue path is unchanged.

## Minimum verification gates

- [ ] A test that a source variant reaches the analyzer with its own field names
      and no `message` or `answer` key.
- [ ] A test that the dialogue variant is unchanged, including its serialized
      payload.
- [ ] A test that `ingestSource` without the option makes no analyzer call.
- [ ] A test that with the option it stages, commits, and reports counts,
      against a fake analyzer and classifier.
- [ ] A test that an analyzer failure degrades the ingest rather than losing the
      stored evidence.
- [ ] `npm run typecheck` clean and `npm test` green from a 300-case core
      baseline.
