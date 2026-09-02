import type { GuiSession } from "./types.js";

const stub: GuiSession = {
  status: "idle",
  sessionId: undefined,
  model: "nvidia/nemotron-3.5-lightning-30b-a3b",
  thought: "",
  answer: "",
  error: undefined,
  async connect() {},
  async prompt() {},
  async cancel() {},
};

/** A008-0033 replaces this stub. Keep the export name and GuiSession shape. */
export function useGuiSession(): GuiSession {
  return stub;
}
