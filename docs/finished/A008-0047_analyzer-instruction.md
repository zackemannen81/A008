# Task A008-0047 — Post-output analyzer instruction rewrite

Status: Complete
Owner: Operator, on owner-supplied text
Created: 2026-09-03
Completed: 2026-09-03
Branch: `claude/A008-0047-analyzer-instruction`

## Change

`POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION` replaced with the owner's version,
developed by iterating against several models from several providers. It goes
from 5 lines to 21, and from 331 to 1575 joined characters.

The substance of the change is a shift from "extract durable, reusable
knowledge" to an explicit completeness contract: every distinct durable claim,
one semantic relation per item, recursive splitting of non-atomic propositions,
an explicit do-not-split rule for homogeneous list members, strict source
fidelity, and a pre-return checklist.

## What the operator changed in the supplied text, and why

The text as supplied did not compile. Two array elements were missing their
trailing commas — after `"…directly entailed by the source. ;"` and after
`"Completeness is more important than brevity."` — which makes them adjacent
string literals inside an array literal, a syntax error. A stray ` ;` inside the
first of those strings was also removed.

Nothing else was altered. Wording that has been tested against real models is
not something to tidy.

## What was deliberately left alone

The supplied text says the field allow-list twice. Joined, the instruction
carries both "Each array item may contain only proposition, kind, tags,
domains, entities, and confidence." and "Each item may contain only:
proposition, kind, tags, domains, entities, confidence."

That redundancy is kept. It was presumably present in the version the owner
measured, and removing it would change the prompt away from what was tested. It
is flagged rather than silently fixed.

## Relationship to A008-0046

These two are one finding split across two tasks. This instruction is why an
ordinary factual text now yields tens of proposals; A008-0046 raised the staging
ceiling from 8 to 128 so they are not discarded. Neither is useful without the
other.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | clean |
| Core suite | `npm run test:core` | 297 pass, 0 fail |
| Joined output | inspected | 1575 chars, no newline, no stray `;` |

The new case guards the two properties that are structural rather than
stylistic, so a future rewording cannot silently drop them:

- the untrusted-data framing, which is what stops an injection attempt inside
  extracted document or answer text from being read as an instruction;
- the one-array output contract, which `serializeSemanticJsonRequest` parses
  strictly, plus the field allow-list the staging validator enforces.

It also asserts the value is a joined string with no newline, so an array cannot
leak into the request.

## Not done

- No live provider run. The instruction's extraction quality is the owner's
  measurement, not this repository's; no test here claims it.
- The relation-classifier instruction is unchanged.
