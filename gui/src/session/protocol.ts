import {
  GUI_SESSION_PATH,
  DEFAULT_GUI_HOST,
} from "../../../packages/protocol/src/index.js";
export {
  GUI_SESSION_PATH,
  DEFAULT_GUI_HOST,
  CLIENT_MESSAGE_KEYS,
  GuiHostProtocolError,
  encodeClientMessage,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from "../../../packages/protocol/src/index.js";

export function resolveGuiSessionUrl(
  location:
    | { readonly protocol: string; readonly host: string }
    | undefined = typeof globalThis.location === "object"
    ? globalThis.location
    : undefined,
): string {
  if (location === undefined || location.host === "")
    return `ws://${DEFAULT_GUI_HOST}${GUI_SESSION_PATH}`;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}${GUI_SESSION_PATH}`;
}
