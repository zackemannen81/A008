import type { GuiSession } from "../session/types.js";

const originals = new WeakMap<GuiSession, GuiSession["prompt"]>();

/**
 * Observe user text on the shared `GuiSession` object. Composer calls
 * `session.prompt`; ChatPane records the argument without changing the stub
 * type. Restores the previous `prompt` on dispose.
 */
export function captureSessionPrompt(
  session: GuiSession,
  onUserMessage: (text: string) => void,
): () => void {
  const original = originals.get(session) ?? session.prompt.bind(session);
  originals.set(session, original);

  const wrapped: GuiSession["prompt"] = async (text) => {
    if (text.trim() !== "") {
      onUserMessage(text);
    }
    return original(text);
  };

  try {
    (session as { prompt: GuiSession["prompt"] }).prompt = wrapped;
  } catch {
    return () => {};
  }

  return () => {
    if (session.prompt === wrapped) {
      (session as { prompt: GuiSession["prompt"] }).prompt = original;
    }
  };
}
