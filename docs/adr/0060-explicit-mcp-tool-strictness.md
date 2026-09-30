# ADR 0060 — Explicit MCP tool strictness

Status: Accepted
Date: 2026-09-30
Decision owner: Rickard (explicit request to integrate ACME non-strict)
Task: A008-0202

## Authority and need

PC-LF-04 assigns model execution to ACME and tool policy/execution to A008.
The owner installed acme-engine 0.1.7 and requested explicit non-strict support
with strict defaults and local validation. Installing the package alone did not
pass a strict field from A008's tool mapping.

## Decision

MCP catalog entries accept optional `strict: boolean` and
`toolStrict: Record<string, boolean>` keyed by original MCP tool name. Effective
mode is tool override, then server default, then true. Old catalogs remain strict.
GUI allows editing the default and individual overrides and shows saved choices.
Unknown tool names have no effect until the server advertises that exact name.

The existing ACP server descriptor carries resolved configuration in namespaced
`_meta["a008/toolPolicy"]`, preserving standard ACP fields and transports.
ModelToolSession resolves mode at discovery and publishes `ChatToolDefinition.strict`.
The ACME request mapping always supplies a boolean, including true for native
tools. The embedded runtime and direct compatible adapter use published 0.1.7.
No automatic fallback or weaker retry is added. Structured final output is not
changed by MCP policy.

Both modes validate complete JSON arguments locally against the original MCP
schema before approval and execution. Strict alone restores the existing optional
null omission sentinel. Non-strict arguments retain explicit null and fail if the
original schema disallows it. Existing runtime session-selector binding and replay/
containment checks still apply, then validation runs. The model-facing schema
still excludes runtime-owned session selectors; non-strict adds no new schema
lowering. ACME sends this offered schema unchanged for non-strict.

Invalid calls return the existing invalid_arguments tool result; the existing
bounded tool loop may let the model correct them. No new retry budget is created.
Policy participates in catalog fingerprints so health can identify stale tool
sessions. It is not sent as process environment or semantic memory.

## Verification and limits

Local real MCP process tests prove rejection before permission or file effects,
strict/null behavior and valid execution. Installed ACME wire tests exercise both
Responses and Chat Completions with mixed strict modes, unchanged propertyNames
on the non-strict tool and one surfaced simulated provider rejection with no
fallback. These prove A008 mapping, not acceptance by every live provider/MCP.
Changes apply when a tool session is composed; in-flight sessions retain their
existing catalog. A new GUI chat is a reliable way to pick up saved settings.
