import { useDurableChat } from "./use-durable-chat.js";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  createGuiSessionClient,
  detectBrowserCredentials,
} from "../../../packages/client/src/index.js";
import { engineAccessToken } from "./engine-access.js";
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
 * Standalone browsers observe durable runs; capability-bound engine panels
 * and explicit legacy embeddings retain their existing V1 session client.
 */
export function useGuiSession(options?: GuiSessionClientOptions): GuiSession {
  return engineAccessToken() || options ? useLegacyGuiSession(options) : useDurableChat();
}
function useLegacyGuiSession(options?: GuiSessionClientOptions): GuiSession {
  const clientRef = useRef<GuiSessionClient | undefined>(undefined);
  if (clientRef.current === undefined) {
    const location =
      typeof globalThis.location === "object" ? globalThis.location : undefined;
    clientRef.current = createGuiSessionClient({
      ...options,
      location: options?.location ?? location,
      credentials:
        options?.credentials ?? detectBrowserCredentials(location),
    });
  }
  const client = clientRef.current;
  useEffect(() => {
    if (engineAccessToken()) void client.connect().catch(() => undefined);
    return () => client.dispose();
  }, [client]);
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
    permission: snapshot.permission,
    resolveToolPermission: client.resolveToolPermission,
    tools: snapshot.tools,
    details: snapshot.details,
    busy: snapshot.busy,
    pendingText: snapshot.pendingText,
    controlSession: client.controlSession,
    endSession: client.endSession,
    status: snapshot.status,
    sessionId: snapshot.sessionId,
    model: snapshot.model,
    thought: snapshot.thought,
    answer: snapshot.answer,
    error: snapshot.error,
    connect: connectRef.current,
    prompt: client.prompt,
    generateImage: client.generateImage,
    cancel: client.cancel,
  };
}
