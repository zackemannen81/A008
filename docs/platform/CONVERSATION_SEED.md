# Trusted conversation seeding

The platform backend can initialize one existing EngineHost session with its
own committed conversation identity and history. This is an internal
composition option, not an ACP, WebSocket, V1 or V2 request field.

```ts
engine.newSession(request, client, {
  initialModel,
  conversationSeed: {
    conversationId: "A008_v1_conversation_<uuidv4>",
    messages: [
      { role: "user", content: "Committed user content" },
      { role: "assistant", content: "Committed assistant content" },
    ],
  },
});
```

The seed crosses `EngineHost.newSession` → `A008AcpAgent` →
`createAcpRuntime` → `LocalMemoryRuntime.openSession`. The runtime parses the
conversation identity as an A008 `conversation` ID and accepts only committed
`user` and `assistant` messages whose content satisfies the existing canonical
chat-content schema. It copies accepted messages before constructing the
existing `ChatSession`.

Seeding creates no provider call, semantic-memory read/write, extraction,
reinforcement, or workspace-conversation store write. The first new user turn
uses the existing memory-aware/provider pipeline and its existing bounded
history projection; its normal post-output rules apply only to that new turn.

`workspaceConversation` and `conversationSeed` are mutually exclusive. A
seeded session never reads, selects, overwrites, or persists a legacy workspace
conversation. Existing sessions that omit the internal option retain their
current V1/V2 and workspace behavior.
