# Relation-gated memory commit

Status: Implemented provider-neutral write-side boundary. An exported model-
backed classifier can use the shared stateless semantic JSON owner. No automatic
chat/CLI/ACP/Canvas invocation is connected.

## Purpose

`RelationGatedMemoryCommit` turns one already-staged semantic proposal into one
explicit, guarded `SemanticMemory.reconcile` operation. It separates three
authorities:

1. the candidate store finds bounded possible matches;
2. an untrusted semantic classifier selects a relation using local handles; and
3. runtime validates and maps that decision while `SemanticMemory` alone owns
   the canonical transition.

The service does not analyze raw provider output. Reasoning was excluded before
staging and is not accepted by this contract.

## One-proposal flow

```text
validated StagedKnowledgeBatch + proposalIndex
                    |
                    v
     revalidate identity, namespace, exact batch,
       proposal index, and conservative fields
                    |
                    v
 one bounded indexed candidate search (current canon)
                    |
                    v
 materialize active + dormant semantic candidates
                    |
                    v
 exact-budget ID-free classifier envelope
 candidate_1, candidate_2, ...
                    |
                    v
 validate one five-way relation and map handles locally
                    |
                    v
 guarded SemanticMemory.reconcile inside repository transaction
                    |
          .---------+----------.
          |                    |
      conflict            current item
          |                    |
 index not_required     entity/domain upsert
                               |
                      updated / pending_repair
```

Exactly one proposal is processed per call. This prevents a partial batch from
being presented as one atomic outcome.

The separate [post-output memory coordinator](POST_OUTPUT_MEMORY_COORDINATOR.md)
owns sequential multi-proposal processing. It stops on `pending_repair` and
resumes without replaying an earlier commit; this service remains deliberately
one-proposal scoped.

## Candidate materialization

`IndexedRelationCandidateSource` derives its retrieval plan from the staged
proposal and caller-verified identities:

- project ID is the hard storage namespace;
- staged scope constrains applicability;
- entities feed the exact channel;
- normalized proposition/kind/tag/domain/entity terms feed lexical retrieval;
- tags and domains use weight `1`; and
- semantic queries and vectors are empty in this provider-free implementation.

The source calls `MemoryCandidateStore.retrieveCandidates` once, retains the
best hit per channel and ID, sums those channel scores, orders by descending
aggregate score then ascending ID, and applies a configured hard maximum. Each
hit is re-materialized with `SemanticMemory.getKnowledge`; a non-current index
result fails closed. Active and dormant current items are both valid comparison
candidates. Returned items are defensive copies.

## Classifier boundary

The classifier sees stable JSON containing:

```ts
interface RelationClassifierInput {
  proposal: {
    proposition: string;
    kind: string;
    tags: readonly string[];
    scope: readonly string[];
    domains: readonly string[];
    entities: readonly string[];
    confidence: number;
  };
  candidates: readonly {
    handle: string;
    proposition: string;
    kind: string;
    tags: readonly string[];
    scope: readonly string[];
    authority: number;
    confidence: number;
    activationStatus: "active" | "dormant";
  }[];
}
```

It never receives durable/runtime IDs, revisions, scores, channel reasons,
provenance, audit, repository details, chat history, reasoning, or completion
metadata. A fresh serialization round trip removes unrelated runtime
properties before classification.

`ModelBackedKnowledgeRelationClassifier` sends that exact serialization beneath
the `relation_classification` operation through an injected shared
`SemanticJsonGenerator`. It returns parsed untrusted JSON; this service remains
the sole validator of relation types and local handles.

The configured measurer evaluates the exact serialized envelope. Candidate
order is stable. If the envelope is too large, candidates are removed only from
the tail until it fits. The staged proposal itself is mandatory; if its empty-
candidate envelope exceeds the limit, the call fails before classification.

## Relation output

Accepted classifier decisions are:

| Classifier result | Runtime mapping |
| --- | --- |
| `{ type: "new" }` | `{ type: "new" }` |
| `restatement` + one known handle | same relation + mapped target ID |
| `extend` + one known handle | same relation + mapped target ID |
| `supersede` + one known handle | same relation + mapped target ID |
| `conflict` + unique known handles | conflict + mapped target IDs |

Field `relation` is a bounded alias for `type`. Names are trimmed and
case-folded. JSON `null` is omitted, so live `{ relation: "new", targetHandle:
null }` is canonical `new`. If both fields are present they must agree.

Unknown relation types, invented labels such as `create`, missing type,
conflicting `type`/`relation`, invented handles, duplicate conflict handles, and
empty conflicts fail before reconciliation or indexing. The unknown-type error
includes the returned value. Classifier-added explanation or control properties
are not forwarded; only explicitly materialized relation fields survive.

## Stale-state guard

Every materialized candidate contributes `{ id, revision }` to a
`ReconciliationGuard`, including a candidate removed from the classifier
envelope by the exact budget. `SemanticMemory.reconcile` validates the complete
guard inside its repository transaction before applying any transition. A
missing, superseded, or revision-changed record returns `MemoryError` code
`stale_state`, leaving that guarded reconciliation's canon and audit unchanged.

Existing callers may omit the guard and retain the earlier explicit reconcile
behavior.

## Index completion and repair

Canonical SQLite persistence, audit, FTS, and tag changes remain atomic inside
the repository transaction. Entity/domain metadata comes from the staged
proposal and is upserted after a non-conflict reconciliation for the returned
current item.

The result makes completion explicit:

- `updated`: canonical truth committed and entity/domain document upserted;
- `not_required`: conflict wrote audit but did not change current canon; or
- `pending_repair`: canonical truth committed, but the bounded entity/domain
  document upsert failed.

`repairIndex(pending)` retries only the copied retrieval document. It does not
call the classifier or reconcile again. A caller must preserve or queue the
pending document before reporting a fully indexed write.

## Concurrency and failure

One service instance permits one active commit or repair. Overlap fails with
`illegal_state`. Input, budget, candidate, and classifier failures occur before
canonical writes. A stale-state failure occurs inside and rolls back the
canonical transaction. Only the explicit `pending_repair` result represents a
successful canonical write followed by incomplete optional metadata.

An optional `AbortSignal` is forwarded to the classifier. Cancellation before
reconciliation is a thrown commit failure and therefore retains the same
proposal index for the outer coordinator; it cannot hide a canonical write.

V0 does not prevent two concurrent `new` decisions from expressing the same
meaning. Solving that requires a later database-owned semantic uniqueness key,
not an in-memory preflight claim.

## Verification boundary

Fake/local tests cover deterministic ordering, dormant candidates, defensive
copies, ID/control/reasoning exclusion, exact multibyte budgets, tail trimming,
malformed decisions, one-call ownership, concurrency, index failure, and
repair. Actual in-memory SQLite tests cover all five relations, stale revision,
canonical/history/audit state, and subsequent exact/entity, lexical, tag, and
domain retrieval.

No test loads `.env.local`, calls a provider, starts Docker or Supabase, uses an
external database, or invokes CLI, ACP, Agent Server, or Canvas memory writes.

See [ADR 0010](adr/0010-relation-gated-memory-commit.md),
[Semantic Memory v0](SEMANTIC_MEMORY.md), and
[Post-output knowledge intake](POST_OUTPUT_KNOWLEDGE_INTAKE.md). The concrete
call boundary is documented in
[Stateless semantic JSON model calls](SEMANTIC_JSON_MODEL_CALLS.md).
