# ADR 0027 — Runtime budgets and global instructions

Status: Accepted
Date: 2026-09-07
Task: A008-0066
Amends: ADR 0008 history bound, ADR 0013 runtime configuration, ADR 0024 scope
ceiling and ADR 0026 session-control contract.

## Decisions

1. Local runtime budgets have one editable settings schema. Generated chat tokens
   remain per-session; input bytes, memory projection/staging, semantic output,
   retrieval/intake counts and request timeout are global runtime preferences.
   Byte measurements are serialized UTF-8 sizes, not model token counts.
2. Global preferences are stored outside the repository and separately from memory
   in `~/.a008/settings.json`, overridable by `A008_SETTINGS_PATH`. The runtime owns
   validation and atomic persistence with optimistic revision checks. The GUI
   accesses them through an owned session, using additive `configureRuntime`.
   Each operation captures settings once; running operations retain that snapshot.
3. The initial chat input limit becomes 131072 bytes, semantic input and staged
   batch limits 262144 bytes. The independent projection default remains 32768.
   These defaults remove the known inconsistent 16384-byte bottleneck while
   remaining explicit local limits. Provider context limits still apply.
4. The previous two-message history window remains the default, now configurable
   including zero. Full committed history remains intact. Scope and intake
   ceilings are editable, with their existing defaults preserved.
5. User-written global instructions are deterministic system-level context on
   every chat invocation. They are loaded independently of semantic retrieval,
   model identity, project memory, history windows and resets. Empty text disables
   them. No automatic conversion of chat or memory to instructions is introduced.
6. Retrieved content stays reference data under the existing envelope contract.
   Instructions are never inserted into semantic system prompts or synthetic
   history. Post-output still receives only the original message and actual final
   answer. Settings do not themselves trigger model calls or memory writes.

## Consequences

The GUI can repair the reported input-limit failure and explain each budget's
purpose. An identity rule such as Agent 008 no longer depends on retrieval finding
an old message. This guarantees instruction delivery, not model obedience.
Transport/file integrity limits and endpoint-enforced model ceilings remain
separate constraints; they are not disguised as configurable token budgets.
