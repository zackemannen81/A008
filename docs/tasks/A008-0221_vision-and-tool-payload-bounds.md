# A008-0221 — Bound vision and MCP binary payloads

Status: In Progress (local branch, not integrated)
Owner: Rickard (operator); ChatGPT (implementation)
Date: 2026-11-19
Branch: fix/a008-0221-vision-tool-payload
Base: 7739694

## Goal and necessity
Owner observed repeated 25.8–27.3 MB serialized OpenAI Responses requests, hard-budget failures and a truncated provider stream while editing SwipeOut. The accepted local-first contract PC-LF-03 (A008 owns context), PC-LF-04 (ACME owns model execution) and PC-LF-05 (durable sessions) require prompt context to be bounded without overwriting user source or replaying tool effects.

## Primary deliverable
Reduce oversized vision attachments to an explicit bounded provider-only representation and remove non-textual MCP binary content from model-visible tool results.

## In scope
- Re-encode oversized PNG/JPEG/WebP model attachments to bounded WebP without changing source files.
- Preserve GIF bytes and small-image identity.
- Remove image/audio inline Base64 from textual MCP results; preserve metadata and artifact reference text.
- Deterministic regression tests, compilation, targeted runtime tests and documentation.

## Out of scope
- Provider-side truncation bug, universal automatic turn retry, UI process restart, modifying active user runs, changing semantic memory or source ingest.
- Upload, release or publish.

## Minimum verification gates
- [x] TypeScript build.
- [x] Image optimization tests including source immutability / corrupted input.
- [x] MCP screenshot result test.
- [x] Existing ACME, tool, runtime working-context, ACP and session process regressions.
- [ ] Owner verification after restarting A008 and rerunning the previously failing task.

## Necessity gate
| Change | Approved clause | Observable failure without fix | Smallest approach | Verification |
| --- | --- | --- | --- | --- |
| Limit model image payload | PC-LF-03, PC-LF-04 | Repeated large source PNG pushes request beyond hard budget | Model-only WebP with 1 MB ceiling | vision-image-tool-result tests and exact existing request-budget tests |
| Omit binary from MCP text | PC-LF-04, PC-LF-05 | Base64 is truncated mid-JSON and cannot be interpreted as image | Summarize image/audio blocks only, retain text and artifact path | MCP regression + model-tools suite |

## Execution and verification
No live provider calls; 0 SEK. No repo push or app restart.
Initial focused group: 63/63 passed, including existing ACME and model tools.
ACP/local runtime/session group: 51/51 passed.
Pending: formatting, diff hygiene, wider verification, and user-side replay check.

## Notes
Exact root cause of the provider's missing terminal SSE event remains external/unknown. A008 also sent the same saved image locator on consecutive failed runs, and its original attachment path stays unchanged.
