# Explicit semantic model selection in the Luna parity fixture

Status: Proposed
Observed: 2026-09-30 during A008-0202

`test/acme-execution-parity.test.ts` case "Luna semantic retrieval and extraction
omit unsupported temperature through ACME" fails at the assertion that all
semantic requests omit temperature. It also fails when run alone. The test
opens the chat with Luna but does not configure the independent semantic model.
`DEFAULT_SEMANTIC_SETTINGS.model` uses DEFAULT_MODEL_ID and local-memory-runtime
resolves semantic execution from settings.semantic.model. The test, helpers,
semantic defaults, generation controls and orchestration code are unchanged
from eb30c4b; A008-0202 only adds strict to requests with tools.

Outcome: configure the intended semantic model explicitly in this fixture and
separately preserve coverage that chat model does not override semantic policy.
Not active: semantic model policy is outside MCP strictness integration.
Suggested verification: build, run this test in isolation and the complete
acme-execution-parity suite. Do not change product defaults to satisfy the test.
