export {
  DEFAULT_GUI_MODEL,

  type GuiSessionClientOptions,
  type GuiSessionState,
  type GuiSessionStatus,
  type GuiWebSocket,
  type GuiWebSocketConstructor,
  type GuiWebSocketEvent,
  type PromptImageAttachment,
  type RuntimeToolCall,
  type RuntimeToolStatus,
  type ToolPermissionDecision,
} from "../../../packages/client/src/index.js";

export type GuiSession = import('../../../packages/client/src/index.js').GuiSession & { readonly durable?: import('./durable-chat-client.js').DurableChatClient };
