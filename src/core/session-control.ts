import { ChatError } from "./errors.js";
import type { RuntimePreferencesSnapshot } from "./runtime-preferences.js";
import { parseSessionControlInput } from "../../packages/protocol/src/index.js";
import type { SessionControlInput, SessionSnapshot as WireSnapshot } from "../../packages/protocol/src/index.js";
export type SessionControl = SessionControlInput;
export type SessionSnapshot = WireSnapshot<RuntimePreferencesSnapshot>;
export function parseSessionControl(value: unknown): SessionControl {
  try { return parseSessionControlInput(value); }
  catch (error) { throw new ChatError("configuration", error instanceof Error ? error.message : "Invalid session control action or parameters."); }
}
