import {
  parseSessionControl,
  type SessionControl,
  type SessionSnapshot,
} from "../core/session-control.js";
import { parseClientMessage as parseWireMessage } from "../../packages/protocol/src/index.js";
export {
  errorMessage,
  type ParseFailure,
} from "../../packages/protocol/src/index.js";
import type {
  ClientMessage,
  HostServerMessage,
} from "../../packages/protocol/src/index.js";
export const GUI_HOST_NAME = "A008-gui-host";
export const DEFAULT_GUI_HOST_PORT = 8787;
export const DEFAULT_GUI_HOST_BIND = "127.0.0.1";
export type GuiHostClientMessage = ClientMessage<SessionControl>;
export type GuiHostServerMessage = HostServerMessage<SessionSnapshot>;
export function parseClientMessage(raw: string) {
  return parseWireMessage(raw, parseSessionControl);
}
