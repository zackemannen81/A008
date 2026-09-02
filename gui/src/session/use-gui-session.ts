import { useRef, useSyncExternalStore } from "react";
import { createGuiSessionClient } from "./gui-session-client.js";
import type { GuiSessionClient } from "./gui-session-client.js";
import type { GuiSession, GuiSessionClientOptions } from "./types.js";

/**
 * Wraps a client call so it settles instead of rejecting.
 *
 * `GuiSessionClient.connect` rejects on a failed handshake, which is the right
 * contract for a programmatic caller. The settings pane fires connect and
 * forgets it (`void session.connect()`), so an unwrapped rejection would only
 * become an unhandled promise rejection in the browser. The failure is already
 * carried by `status` and `error`, so the view-facing `connect` settles.
 */
export function settleQuietly(run: () => Promise<void>): () => Promise<void> {
  return () =>
    run().then(
      () => undefined,
      () => undefined,
    );
}

/**
 * Browser client for A008 GUI host protocol v1 (ADR 0019 D4).
 *
 * The hook owns one `GuiSessionClient` per mount and re-renders through
 * `useSyncExternalStore`. It does not connect on mount: the settings pane
 * offers an explicit Connect action while `status` is `idle` or `error`.
 */
export function useGuiSession(options?: GuiSessionClientOptions): GuiSession {
  const clientRef = useRef<GuiSessionClient | undefined>(undefined);
  if (clientRef.current === undefined) {
    clientRef.current = createGuiSessionClient(options);
  }
  const client = clientRef.current;
  const connectRef = useRef<(() => Promise<void>) | undefined>(undefined);
  if (connectRef.current === undefined) {
    connectRef.current = settleQuietly(client.connect);
  }
  const snapshot = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getSnapshot,
  );

  return {
    status: snapshot.status,
    sessionId: snapshot.sessionId,
    model: snapshot.model,
    thought: snapshot.thought,
    answer: snapshot.answer,
    error: snapshot.error,
    connect: connectRef.current,
    prompt: client.prompt,
    cancel: client.cancel,
  };
}
