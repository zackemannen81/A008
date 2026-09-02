# Legacy provenance boundary

Status: Local provenance; not product authority

Discoverability: local source is intentionally not indexed or tracked.

The local `agenten007/` directory is owner-supplied evidence for the pre-a007
CLI. Git ignores it in full. This README records only reviewed, non-secret facts.

## Observed reusable behavior

- Node.js ES modules with Axios and readline.
- NVIDIA OpenAI-compatible chat-completions requests.
- Model registry, per-model defaults and parameter validation.
- Streaming and non-streaming response handling.
- Conversation rollback on failure, tool-call chunk aggregation, error
  classification, and model fallback.

## Security boundary

The raw source contains a hard-coded NVIDIA credential. The owner reports it was
revoked and rotated on 2026-09-01. Do not execute, stage, commit, copy, or share
the directory: it still embeds the retired value. A007-0003 replaced secret
access with `NVIDIA_API_KEY` at the new adapter boundary and uses fake HTTP for
normal verification.

## Intake rule

A007-0003 extracted reviewed behavior into new a007-owned modules without
copying the monolith. Future intake still must not import `node_modules`,
generated HTML, unrelated media/text, empty instruction files, or retired
credentials.
