# ADR 0015 — Reasoning has no path to knowledge

Status: Accepted

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

A live NVIDIA Nemotron turn showed `delta.reasoning_content` carrying only a
short chain-of-thought prefix. The remainder of that thinking, plus the
user-visible answer, arrived on `delta.content`. `ChatSession` committed the
contaminated content. Post-output intake then sent the thinking to
`knowledge_analysis` with the chat thinking profile (`enableThinking: true`,
`reasoningBudget: 16384`), which timed out. Traces emitted `memory_read` after
chat, paired the chat HTTP body with the analyzer call, duplicated
`memory_failure`, and marked the whole turn as `error` even though chat
succeeded.

## Decision

- NVIDIA streaming and JSON completions are normalized by channel transition.
  After `reasoning_content`, long or chain-of-thought `content` is held and
  split at an answer boundary (`</think>`, `I'll generate the response`, `✅`).
  Only the user-visible answer becomes `message.content` and content deltas.
- Semantic JSON calls use a dedicated non-thinking profile: `stream: false`,
  `enableThinking: false`, no `reasoningBudget`, bounded `maxTokens`.
- `PostOutputKnowledgeIntake` receives `verifiedFinalAnswer(completion)` only.
- `memory_read` is emitted from the reader. Chat HTTP clones are flushed before
  post-output. HTTP events carry `httpCallId`. `memory_failure` is emitted once.
  Successful chat with failed memory is `turn_complete` `degraded`.
- Holy invariant: no emitted reasoning substring may appear in analyzer input,
  committed history, retrieval dialogue, or canonical proposal source.

## Alternatives considered

### Trust provider channel labels

Rejected. The live stream switched channels mid-thought.

### Stream leaked content and strip later

Rejected. CLI/ACP would display reasoning as the answer, and ChatSession would
commit it before a later filter.

## Consequences

- Reasoning remains display/trace-only.
- Semantic calls cannot inherit the chat thinking budget.
- A timed-out analyzer no longer looks like a failed chat turn.
