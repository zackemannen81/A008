# Task A008-0049 — Source knowledge extraction

Status: Complete
Owner: Operator
Parent: A008-0041 (wave 2)
Created: 2026-09-03
Completed: 2026-09-03
Branch: `claude/A008-0049-source-knowledge-extraction`

## The charter was wrong, and finding out why was the work

It scoped this as a staging-shape change: `StagePostOutputKnowledgeInput` is a
dialogue pair, so give it a source variant. That was true but far from
sufficient.

Reading the commit path revealed that `KnowledgeEngineCommit` assumes a user
turn in two hardcoded places:

```ts
// #ingestOnce
content: input.batch.sourceMessage,
speaker: "user",
locator: `turn:${input.batch.taskId}`,

// after recording the claim
accept({ …, authority: { verified: true, speakerRole: "user" },
         sourceMessage: input.batch.sourceMessage }, …);
```

For an uploaded document both are wrong, and the second is dangerous.

**The danger.** `isExplicitUserAssertion(message, proposition)` returns true when
the normalized source message *contains* the proposition. A document contains
every proposition extracted from it — that is what extraction means. So routing
a source batch through the existing path with its content as `sourceMessage`
would have set `keepAlive` on **every claim in the document**, accepting an
uploaded file as though the user had personally stated each fact in it.

**The duplication.** `ingestSource` had already created an utterance with the
extractor's own speaker, relation and locator. `#ingestOnce` would have ingested
the same content a second time as `speaker: "user"` with a fabricated `turn:`
locator, replacing the provenance A008-0040 and A008-0042 exist to get right.

## Change

`StagedKnowledgeBatch` gains an origin:

```ts
type StagedBatchOrigin =
  | { kind: "dialogue" }
  | { kind: "source"; utteranceId: string };
```

- Analyzer and staging inputs became discriminated unions. A source is
  serialized as `{ locator, content }`, never as `{ message, answer }`: the
  payload is what the model reads as untrusted data, so naming a document
  wrongly frames it wrongly.
- A source batch carries its **locator** as `sourceMessage`, never its content.
- The commit path reuses the source's existing utterance instead of re-ingesting.
- The commit path refuses user-assertion acceptance for a source on origin
  alone, independently of what `sourceMessage` holds.
- `LocalMemoryRuntime.ingestSource` gained opt-in `extractKnowledge`, off by
  default, minting its own conversation and task identity because a source is
  not a conversation. A failed extraction degrades the ingest; the stored
  evidence is untouched.
- `_a008/source/ingest` carries the option and reports the outcome.

## Why the acceptance guard is two layers

Either alone would do the job today. Together they mean a mistake in one is not
a silent data-integrity failure. The tests prove each layer independently: one
sets `sourceMessage` to the content to check the commit path still refuses.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | clean |
| Full gate | `npm test` | 308 core + 75 GUI, 0 fail, 0 skipped |
| Upload proof | operator harness | 13 of 13 |
| Chat proof | operator harness | 15 of 15 |

308 accounts for the 306 baseline after this task's staging tests plus the two
runtime cases.

### Mutation checks

| Mutation | Result |
| --- | --- |
| `sourceMessage` set to the document content | **1 fail** |
| user-assertion acceptance applied to sources | **1 fail** |
| source re-ingested instead of reusing its utterance | **1 fail** |
| all reverted | 308 pass, 0 fail |

The second mutation initially passed. It only bites because a test deliberately
arms the trap — a source batch whose `sourceMessage` is the whole document —
which is the only way to prove the second layer holds on its own.

## Out of scope

- Chunking. One source is still one utterance.
- `src/gui-host/` and `gui/`. `POST /v1/upload` cannot yet request extraction;
  that is a follow-up.
- Any live provider call. The runtime test drives the failure path, since no
  credential is configured.
