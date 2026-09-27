import { useEffect, useRef, useSyncExternalStore } from "react";
import { DurableChatClient } from "./durable-chat-client.js";
import { guiHttp } from "../client.js";
import type { GuiSession } from "./types.js";

export function useDurableChat(): GuiSession {
  const ref = useRef<DurableChatClient | undefined>(undefined);
  if (!ref.current) ref.current = new DurableChatClient(guiHttp());
  const client = ref.current;
  const state = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getSnapshot,
  );
  useEffect(() => {
    void client.connect();
    return client.dispose;
  }, [client]);
  return {
    ...state,
    connect: client.connect,
    prompt: client.prompt,
    cancel: client.cancel,
    resolveToolPermission: client.resolveToolPermission,
    durable: client,
    controlSession: client.controlSession,
    endSession: async () => client.dispose(),
  };
}
