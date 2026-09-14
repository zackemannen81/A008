export * from "./schemas.js";
export * from "./host-parser.js";
export * from "./client-parser.js";
export * from "./routes.js";
export const GUI_SESSION_PATH = "/v1/session";
export const DEFAULT_GUI_HOST = "127.0.0.1:8787";
export const CLIENT_MESSAGE_KEYS = [
  "type",
  "requestId",
  "sessionId",
  "text",
  "model",
  "control",
  "permissionId",
  "allow",
  "resumeToken",
] as const;
