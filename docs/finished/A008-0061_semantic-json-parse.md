# Task A008-0061 — Diagnose and recover a non-JSON semantic response

Status: Complete
Owner: Operator
Parent: ADR 0012 D6
Created: 2026-09-05
Completed: 2026-09-05
Branch: `claude/A008-0061-semantic-json-parse`

## Why

From a live GUI host run:

```text
memory> memory staging failed: invalid_response: Semantic model assistant
        content must be strict JSON.
```

The message named the rule and nothing else. Not the length, not the finish
reason, not one character of what arrived. Three causes need three different
responses and it distinguished none of them:

| cause | what it needs |
| --- | --- |
| the answer was cut off by the output budget | a larger budget |
| the model wrapped the JSON in a markdown fence | unwrapping |
| the model refused, or explained instead of extracting | the prompt looked at |

`finishReason` tells the first apart from the other two and was already sitting
on the completion, unread.

## The decision I did not get to make alone

The first version of this fix also extracted the first balanced JSON span out of
prose. That was wrong, and ADR 0012 said so before I wrote it:

> **Accept Markdown fences or extract the first JSON fragment.** Rejected.
> Recovery heuristics can silently reinterpret prose or injected text. Strict
> whole-content parsing gives deterministic failure to the existing checkpoint
> owner.

The reasoning holds. The analyzer's input is untrusted — a user message and a
model answer, and since A008-0056 an uploaded document. A source document can
contain a JSON array. A model quoting that array back while refusing to extract
would have had the quote parsed as its answer.

So fragment extraction was removed before shipping and stays rejected. ADR 0012
D6 splits the rejected pair rather than overturning it, because the two halves
are not the same act:

- A **fragment** is chosen from among alternatives inside a larger text.
- A **fence** wraps the entire content. Removing it either yields the exact
  payload the model produced or fails as before. Nothing is selected.

The recovery is anchored to a fence that opens at the start and closes at the
end. **That anchoring is the security boundary, not a tidiness detail** — an
unanchored pattern would find a fenced block anywhere in the content, which is
fragment extraction under another name. A test asserts a fence buried in prose
is still refused.

## The diagnostic

A parse failure now reports the content length, the finish reason, and a bounded
single-line excerpt of the model's own output. When the finish reason is
`length` it says the answer was cut off and names the setting to raise.

This changes nothing about what is parsed or returned. ADR 0012's line that the
finish reason is ignored is narrowed to mean ignored *for the result*.

The excerpt is the model's own text and carries no credential — the semantic
call sends none. It is capped at 200 characters, flattened to one line, and
marked when clipped, so it stays readable in a log and cannot bury one.

## What is still refused

Malformed JSON. A missing bracket is not packaging, and guessing at it would put
invented structure into the knowledge store. `[{"proposition":"A"},` is valid
the moment anything is appended, which is precisely why nothing is.

## Verification

`npm test`: 396 core, 4 membership, 75 GUI, 0 fail, 0 skipped, up from 391. Six
new cases.

Seven mutations, each applied alone, all seven caught:

| mutation | caught by |
| --- | --- |
| fence recovery removed | a fenced JSON answer is read instead of discarded |
| fence no longer required to wrap the whole content | a fence buried in prose is refused, not unwrapped |
| truncation reported as ordinary syntax | a truncated answer names the budget, not the syntax |
| excerpt dropped from the error | a non-JSON answer reports what actually arrived |
| excerpt no longer bounded | the excerpt is bounded and flattened to one line |
| excerpt keeps its newlines | the excerpt is bounded and flattened to one line |
| malformed JSON repaired | recovery never repairs malformed JSON |

Three of these survived a first round and were real gaps rather than false
alarms. The anchoring one is the reason to record that: the test suite had a
case for prose without a fence and none for prose *around* a fence, so the
property that keeps the recovery from becoming fragment extraction was untested.

## What this does not do

It does not say which of the three causes the owner actually hit. That was the
point — the failure is now self-describing, and the next occurrence will name
itself. If it turns out to be truncation, the remedy is a budget, and
`SEMANTIC_JSON_GENERATION.maxTokens` is 16384 against a provider playground that
accepts 32768 for the same model.

One thing worth watching: the semantic call uses the model currently selected by
`/model`, and A008-0055 added models whose profiles declare much larger output
budgets and reasoning. `enableThinking: false` is sent, but a model that ignores
it would put reasoning where JSON is expected — and that would now show up in
the excerpt rather than as a bare rule name.
