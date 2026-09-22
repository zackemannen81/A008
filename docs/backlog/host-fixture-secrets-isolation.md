# Host fixture secrets isolation

Status: Open

## Discovery context

A008-0166 isolated `A008_CATALOG_PATH` for `isolatedMemoryEnv`. The same
A008-0149 real-host fixture still leaves `A008_SECRETS_PATH` unset. Host
startup can read `~/.a008/secrets.json` for KIE, OpenAI, OpenRouter, Groq,
Gemini, and OpenCode when those environment keys are absent. NVIDIA is covered
because the fixture sets `NVIDIA_API_KEY`. The charter required this to be
reported rather than absorbed.

## Proposed outcome

Give the shared host fixture a missing temporary secrets path before caller
overrides, and assert that the real-host test does not read the operator
secrets file. Preserve explicit overrides. Do not change product secret
resolution.

## Why it is not active

A008-0164 is implementing the platform host against the current helper.
Changing `isolatedMemoryEnv` in parallel would overlap that verification
surface. This stays backlog until that host task has merged or the operator
assigns a non-overlapping child.

## Dependencies

- A008-0166 merged behavior of `isolatedMemoryEnv`.
- No live provider call is required. The check is local file isolation.

## Suggested verification

Focused V2 real-host test plus one assertion that the default secrets path is
missing and that an explicit override wins. Existing gui-host and v2-auth
suites stay green.
