# A008-0065 — GUI session commands and parameters proof

Task: A008-0065
Status: Complete
Date: 2026-09-06
Boundary: local diagnostic GUI, real GUI host and spawned A008 ACP, isolated
temporary SQLite, synthetic messages and loopback fake provider only.

## Automated verification

- `npm test`: 530 executions, all passed: 442 core + 4 repeated membership +
  84 GUI. No failures, cancellations or skipped tests. All 53 core test sources
  are listed and verified by the membership gate.
- Root `npm run typecheck` and GUI `npm --prefix gui run typecheck`: passed.
- `npm --prefix gui run build`: passed; 61 modules, no new runtime dependency.
- `test/session-controls.test.ts` proves capability/default validation, rejected
  numeric/unsupported options, explicit zero versus null, provider JSON mapping,
  and the real HTTP/WebSocket → spawned ACP → runtime → loopback provider path.
- The end-to-end case proves environment defaults, socket ownership, atomic
  configure failure, committed history without reasoning, failed-turn rollback,
  undo (including empty), reset retaining system/settings, unknown-model rollback,
  model switch, effort parameters, stream/non-stream responses, busy refusal,
  cancellation, close and stale-session refusal. Semantic payload settings stay
  independent of chat settings; secret sentinels do not reach the client.
- GUI cases prove acknowledgment ordering, stale/foreign reply rejection,
  configuration rollback, authoritative transcript without duplicate/live ghosts,
  reset, exit while active, reconnect, malformed-history refusal and slash aliases.
- Existing older fake ACP cases still pass: new snapshots are negotiated through
  the advertised ACP capability, not required of an old composition.

## Browser verification

Real built GUI on loopback, with the same host/ACP/runtime chain. The fixture
never loaded `.env.local` or opened the owner's memory file. Desktop breakpoint
1280×900 and mobile breakpoint 390×844 were checked using native browser actions.

| Flow | Observed result |
| --- | --- |
| Connect inside Parameters | Real session created; effective reasoning budget 4096 from runtime environment appeared |
| Stream off, temperature off, top P off, seed 42, stop sequence, budgets | Applied successfully and reached actual request JSON |
| Reasoning budget 2048 with total 1024 | Rejected visibly; previously applied 256/1024 retained for next message |
| History | Committed question/answer displayed; no system message or thought |
| Undo | Both transcript turns disappeared; an unsent draft remained |
| Memory navigation | Real empty store and all three memory views available; chat/draft preserved on return |
| `/! echo A008-GUI-SHELL-OK` | Native host shell returned exit 0 and expected output |
| Status | Actual model, session, cwd, project, memory path and tools displayed |
| Kimi model selection | Fresh conversation, low/high/max effort choices, fixed top P, no fictitious reasoning-off switch |
| Kimi low effort + temperature 0 | Actual request carried reasoning_effort low and explicit temperature zero |
| Stop on a held test response | Busy controls disabled; after cancellation no partial turn was committed; subsequent message worked |
| Mobile Tools | Terminal and Upload both reachable; returning to Chat preserved transcript |
| Mobile Parameters | Dialog width 390, scrollable controls; Apply reachable; no body overflow |
| Escape | Modal closed and focus returned to Parameters |
| Reasoning off | Actual request carried enable_thinking false and omitted reasoning_budget |
| `/q`, reconnect, End session menu | Session released, empty disconnected chat shown, fresh connection possible |
| Browser console | No warnings or errors in the final checked session |

The initial mobile inspection found the previous three-column shell assigned
zero width to Chat. The final layout gives Chat 390px of a 390px viewport and
uses the Tools header tab to retain workbench access. A CSS-order conflict was
resolved in the owning brand stylesheet before the final browser check.

The manual fixture received nine synthetic requests: five chat requests
(including the deliberately cancelled one) and four semantic requests. The
captured first chat request used stream false, omitted temperature/top_p,
max_tokens 1024, reasoning_budget 256, seed 42 and the requested stop sequence.
Raw payloads and logs remain outside the repository. Screenshots contain only
synthetic conversation data; the status output with machine paths was dismissed
before the final captures.

## Visual evidence

- [Desktop parameter dialog](A008-0065_parameters-desktop.png)
- [Mobile parameter dialog](A008-0065_parameters-mobile.png)
- [Mobile chat and command controls](A008-0065_chat-mobile.png)

The screenshots are test-fixture UI, not evidence of a live model answer.
The temporary viewport was reset and the browser tabs, test host and provider
were closed. No push, publication, deployment or live provider call occurred.
