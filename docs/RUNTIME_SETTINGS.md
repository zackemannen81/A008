# Runtime settings

Implemented by A008-0066 and extended with model-tool limits by A008-0067.
Decisions: [ADR 0027](adr/0027-runtime-preferences-and-instructions.md) and
[ADR 0028](adr/0028-engine-package-and-panels.md).

Parameters has three sections. **Model** changes the current session's stream,
reasoning mode/effort/budget, temperature, top P, generated token ceiling, seed
and stop sequences according to the selected model's actual registry support.
Disabled overrides omit the provider parameter; they do not set it to zero.
The generated token budget includes reasoning and answer, not input or memory
processing. Changing the model starts a new conversation; reopening a borrowed
engine panel keeps the existing session parameters.

**Budgets** edits global limits. Chat input is serialized UTF-8 bytes, including
system instructions, selected dialogue/memory, current question and tool
definitions/results. It is independent of generated tokens. The reported input
error is repaired here. Limits bound runtime work; provider context limits and
transport/file integrity limits remain independent.

**Instructions** is user-written system context sent on every chat invocation.
It survives resets, model changes, projects and restart. Empty text disables it.
It does not depend on memory retrieval and does not configure extraction.
No chat message, source file or retrieved memory is automatically promoted into
instructions. Optional prompt files are neither auto-loaded nor bundled.
Delivery is deterministic; model compliance is not guaranteed by persistence.

A008-0080 delivers those instructions in one system message with any explicit
session base and the applicable memory-handling rule. The generic assistant
fallback is used only when neither session nor global instructions are set.
An explicit CLI `--system` is preserved across model changes, even if its text
equals the generic fallback. Empty/whitespace configuration uses the fallback;
the memory envelope still treats retrieved content as untrusted background.
See [ADR 0035](adr/0035-frozen-instruction-and-memory-target.md), L1.

The shared runtime captures settings once per operation. Mid-turn saves apply
to the next operation. Prior dialogue remains stored in session history even
when the configured projection sends fewer messages. Semantic retrieval scope,
analysis and classification use their own budgets and exclude global instruction
text from their system prompts. Post-output receives original question and final
answer only. A cancelled scope call does not become a successful empty scope.

## Storage and control

`~/.a008/settings.json`, or `A008_SETTINGS_PATH`, stores the full validated
settings document outside the repository and project memory. Version 1 files
retain all 18 original budget values and instructions; the four new tool limits
use defaults. The next explicit save writes version 2. Reads do not rewrite a
file. Invalid/future schemas fail visibly; they do not silently discard settings.

`_a008/session/control` (and WebSocket `session/control.control`) accepts
`{action: "configureRuntime", settings: {instructions, budgets}, revision}`.
Clients obtain `revision`, `defaults`, field metadata and `storagePath` from
`state.runtimePreferences`. Saves atomically replace the file and reject stale
revisions. Reload saved settings before retrying a conflicting edit. Each field
must be a whole number within the metadata's min/max. Use the returned metadata;
do not duplicate hardcoded limits in clients.

## Defaults

| Budget | Default | Unit |
| --- | ---: | --- |
| Chat input | 131072 | UTF-8 bytes |
| Memory projection | 32768 | UTF-8 bytes |
| Recent dialogue | 2 | messages; zero allowed |
| Semantic input | 262144 | UTF-8 bytes |
| Semantic output | 16384 | tokens, capped by model |
| Extracted batch | 262144 | UTF-8 bytes |
| Proposals per extraction | 128 | proposals |
| Tags / domains / entities per proposal | 16 / 8 / 16 | labels |
| Discussion scope | 32 | domains |
| Offered vocabulary | 200 | labels per axis |
| Retrieval entities / terms | 8 / 16 | hints |
| Retrieval planning history | 2 | messages; zero allowed |
| Retrieval history length | 1000 | characters per message |
| Planned semantic queries | 3 | queries |
| Provider timeout | 180000 | milliseconds |
| Tool calls per turn | 12 | calls, including denial |
| Available tools | 128 | definitions |
| Tool result | 65536 | UTF-8 bytes |
| Tool timeout | 60000 | milliseconds, excluding approval |

`A008_PROVIDER_TIMEOUT_MS` supplies the unsaved provider-timeout default when
configured. Saved preferences take precedence. Memory projection is a selection
target: one oversized record can exceed it; complete input still has a hard cap.
Semantic/vector query settings do not enable a vector backend where none exists.
