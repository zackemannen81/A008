# Debug trace

Status: Implemented opt-in local diagnostics for CLI and A008 ACP.

## Modes

| Mode | Default | What is recorded |
| --- | --- | --- |
| `off` | yes | nothing; no file is created |
| `safe` | no | lifecycle phases, sizes, operation names, selected memory IDs, commit/index outcomes, redacted summaries |
| `raw` | no | safe events plus exact serialized provider messages and raw SSE/JSON response bodies |

Raw mode writes a prominent warning that prompts, projected memory, reasoning,
answers, and semantic JSON may be stored locally.

## Settings

Cross-surface environment:

```text
A008_DEBUG_TRACE=off|safe|raw
A008_DEBUG_TRACE_FILE=<absolute path>
```

CLI also accepts `--debug-trace` and `--debug-trace-file`. Those flags share
the same parser as the environment variables and override them.

Rules:

- `off` ignores a configured file path and creates no artifacts.
- `raw` always requires an absolute file path.
- ACP `safe` and `raw` require an absolute file path so protocol stdout stays
  clean.
- CLI `safe` may print one-line `trace>` summaries to stderr when no file is
  set.

## Security boundary

Every mode excludes:

- `Authorization` and other secret-bearing headers
- API keys and the configured `NVIDIA_API_KEY` value wherever it appears
- environment dumps
- transport internals beyond the request URL/method and redacted headers

Trace IDs correlate read/chat/analyze/classify/commit/index events. They are
not placed in model context, conversation history, canon, or the retrieval
index.

Event payloads are truncated at 65,536 characters. Files stop near 8 MiB and
record an explicit `trace_truncated` event. Fetch tracing clones the HTTP body
and does not consume or alter the provider stream.

ACP stdout remains NDJSON protocol messages under every mode. Memory-failure
diagnostics may appear on ACP stderr; they never rewrite the streamed answer.

## Cleanup

Delete the JSONL file when finished. Do not commit traces. `*.debug.jsonl` is
ignored.
