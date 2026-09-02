# Runtime Identity v0

Status: Implemented contract and in-memory ACP-binding reference. `ProjectId`
is the enforced SQLite memory namespace, and the exported memory-aware chat
session validates project/conversation/task/agent context. No durable
cross-component ACP mapping exists.

## Purpose

Runtime Identity v0 gives a007 stable opaque handles for application state
without confusing an ID with the knowledge behind it. The contract is owned by
[ADR 0006](adr/0006-runtime-identity-v0.md).

## Identity kinds and format

| Kind | Meaning |
| --- | --- |
| `project` | Stable a007 application/project scope. |
| `conversation` | Stable logical conversation across runtime surfaces. |
| `task` | Product runtime work scope; not a docs-first task record. |
| `agent` | Stable logical a007 agent identity. |
| `acp_session` | One ACP protocol session owned by the a007 process boundary. |

Every value has this exact form:

```text
a007_v1_<kind>_<lowercase UUIDv4>
```

Example:

```text
a007_v1_conversation_01234567-89ab-4cde-8abc-0123456789ab
```

`v1` is the format version. The kind is routing metadata. UUIDv4 provides
locally generated entropy. No username, email, path, prompt, title, project
name, or other mutable/user-semantic value is encoded.

`A007-0007` is not a runtime task ID. It is a docs-first repository task
address whose status lives in the task record.

## Public primitives

```ts
const factory = new RuntimeIdentityFactory();
const projectId = factory.create("project");
const conversationId = factory.create("conversation");

parseRuntimeId(projectId, "project");
runtimeIdentityKind(conversationId); // "conversation"
isRuntimeId(conversationId, "conversation"); // true
```

The factory accepts an injected UUID source for deterministic tests. The source
must still return canonical lowercase UUIDv4; invalid entropy is rejected. The
parser rejects unknown versions/kinds, uppercase or malformed UUIDs, and
cross-kind use.

Branded `ProjectId`, `ConversationId`, `RuntimeTaskId`, `AgentId`, and
`AcpSessionId` types catch normal TypeScript mixups. Runtime parsing remains
mandatory at I/O and persistence boundaries because JavaScript, JSON, casts,
and external data can bypass static types.

## External references

External systems keep ownership of their identifiers:

```ts
{
  system: "agent_server",
  kind: "conversation",
  value: "opaque-external-handle"
}
```

`system` and `kind` are lowercase namespaces. `value` is bounded to 512 trimmed,
control-free characters. It is stored and compared opaquely. It does not become
an a007 canonical ID and must not be sent to a model as a substitute for the
conversation or task semantics.

External values may contain sensitive or correlatable data. Control-plane
separation is not a complete privacy policy; durable storage remains prohibited
until classification, minimization, authorization, encryption, retention,
deletion, and export behavior are decided.

## ACP identity binding

`AcpIdentityBinding` is complete or absent:

```ts
{
  projectId,
  conversationId,
  taskId,
  agentId,
  acpSessionId,
  externalReferences
}
```

The repository contract supports:

```ts
await bindings.register(binding);
await bindings.resolveAcpSession(acpSessionId);
await bindings.resolveExternal(reference);
await bindings.listConversation(conversationId);
```

Registration rules are:

1. An identical canonical binding is idempotent and returns `existing`.
2. One ACP session cannot be rebound to different context.
3. One external reference cannot identify two ACP sessions.
4. Bindings sharing a conversation must share project and agent.
5. A conversation may have multiple ACP sessions and runtime tasks.
6. A conflict commits no binding or index changes.

`InMemoryAcpIdentityBindingRepository` serializes concurrent registrations,
commits complete working copies, and returns defensive data. It loses all state
on restart and is not a production registry.

## Current ACP adoption

The default `a007-acp` session ID now uses `RuntimeIdentityFactory` with kind
`acp_session`. A deterministic `createSessionId` injection remains available.
The result is parsed before the session map changes, and a duplicate is rejected
instead of replacing the prior session.

The bridge does not register `AcpIdentityBinding` yet. ACP `session/new` gives
a007 a working directory and MCP server descriptions, not a verified Agent
Server conversation handle, project, logical conversation, runtime task, or
agent identity. Inventing those values would be false mapping. A later
orchestration boundary must supply the complete context explicitly.

## Current memory adoption

`SqliteMemoryRepository` is constructed with one validated `ProjectId`. Every
canonical, audit, index, and retrieval operation is constrained to that hard
namespace. Task applicability scopes may only narrow candidates; they cannot
cross or broaden the project namespace. `HybridMemoryReader` also verifies that
the plan and repository carry the same project before retrieval.

This is local memory adoption of the identity primitive, not a live ACP
binding. Chat and ACP still lack a complete verified project/conversation/task/
agent context and therefore do not invoke memory.

## Current orchestration adoption

`MemoryAwareChatSession` fixes parsed project, conversation, and agent IDs at
construction and parses a runtime task ID for each turn. The memory request and
returned plan/projection must match that envelope before chat transport. These
IDs remain control plane and are stripped from the provider prompt; only
materialized semantic content crosses the context boundary.

This exported application surface proves how verified identity is consumed. It
does not solve how CLI or Agent Server supplies those identities or create an
ACP binding from incomplete protocol input.

## Model-context boundary

Runtime IDs, external references, and bindings belong to routing/control state.
They carry no proposition a model can reason over. If an invocation depends on
a project rule, previous decision, conversation fact, or task constraint, the
relevant semantic content must still be materialized through a bounded context
contract. An ID alone never satisfies invocation closure.

## Deferred work

- durable identity/binding repository and migration format;
- Agent Server/Canvas external conversation intake;
- CLI conversation identity and ACP load/resume;
- conversation/task/agent lifecycle and merge/delete semantics;
- account identity, ACLs, privacy controls, and audit policy;
- binding CLI/ACP/Agent Server intake to the implemented verified-context
  orchestration surface; and
- user-facing identity diagnostics and recovery.
