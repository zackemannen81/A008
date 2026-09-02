# Task A008-0029 — CLI slash commands and native terminal tool

Status: Complete (archived `docs/finished/A008-0029_cli-slash-and-terminal.md`)
Owner: Grok (operator)
Created: 2026-09-02
Parent Task: None

## Goal

Give the A008 CLI the usual interactive `/{command}` surface and a native
terminal tool. Do not add `@langchain/community`.

## Why not LangChain

`npm install @langchain/community` fails because that package peers
`@browserbasehq/stagehand@^1`, which requires `zod@^3.23.8`, while A008 pins
`zod@4.5.4`. `--force` / `--legacy-peer-deps` would hide a broken tree.
LangChain is also outside the provider-neutral core (ADR 0003). Terminal access
is an A008 CLI tool, not a community SDK.

## In scope

- Slash router: `/help`, `/exit`, `/quit`, `/reset`, `/clear`, `/model`,
  `/status`, `/history`, `/undo`, `/cwd`, `/tools`, `/shell`, `/!`
- Native `runTerminalCommand` with timeout, byte cap, cwd, injected runner
- `/shell` and `/!` run in `process.cwd()` (the A008 repo when launched there)
- Docs and tests

## Out of scope

- `@langchain/community`, Stagehand, Browserbase
- Model-invoked tool_calls on `ChatTransport` (still ADR 0003 deferred)
- ACP tool prompts
- Live NVIDIA calls

## Definition of done

- Slash commands never fall through to the model
- `/shell node -e "process.stdout.write('ok')"` returns stdout `ok` in tests
- Existing CLI tests remain green
