# Host fixture secrets isolation

Status: Open — revalidation against current main required

## Discovery context

A008-0164 (platform host) and A008-0166 (catalog fixture isolation) are complete. The current `test/helpers.ts` `isolatedMemoryEnv` sets a temporary `A008_CATALOG_PATH` but does not set `A008_SECRETS_PATH`. `test/A008-0149-client-v2-host.test.ts` uses this helper to start a real GUI host without a secrets-path override. `defaultSecretsPath()` therefore resolves to `~/.a008/secrets.json`; host provider-key resolution may load operator credentials from that default file when environment keys are absent. This remains a test-fixture isolation risk to revalidate, not evidence of a product credential leak.

## Proposed outcome

Give the shared host fixture a missing temporary secrets path before caller
overrides, and assert that the real-host test does not read the operator
secrets file. Preserve explicit overrides. Do not change product secret
resolution.

## Why it is not active

The former A008-0164 overlap is resolved, but this proposal has no current
A008 task ID or reviewed charter. Keep it as an unallocated fixture-isolation
candidate until the owner reviews and assigns a bounded task.

## Dependencies

- A008-0164 and A008-0166 are complete; no live product-provider call is needed.
- Preserve product secret resolution; scope is test-fixture isolation only.

## Suggested verification

Focused V2 real-host test plus one assertion that the default secrets path is
missing and that an explicit override wins. Existing gui-host and v2-auth
suites stay green.
