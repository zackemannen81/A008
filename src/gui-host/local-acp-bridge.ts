import { randomUUID } from "node:crypto";
import type {
  RequestPermissionResponse,
  SessionNotification,
} from "@agentclientprotocol/sdk";
import { EngineHost } from "../engine/engine-host.js";
import type { McpServer } from "@agentclientprotocol/sdk";
import { ProjectRuntimeRegistry } from "../engine/project-runtime-registry.js";
import type { AcpBridge, AcpPromptHandlers } from "./acp-bridge.js";

/** V1 adapter with a fixed project binding and bridge-owned sessions only. */
export function createLocalAcpBridge(options: {
  registry: ProjectRuntimeRegistry;
  env: NodeJS.ProcessEnv;
  cwd: string;
  mcpServers?: () => readonly McpServer[];
}): AcpBridge {
  const project = options.registry.openConfigured(options.cwd, options.env);
  const host = new EngineHost({
    env: options.env,
    registry: options.registry,
    createPanels: false,
    resolveProject: () => project,
  });
  const sessions = new Set<string>();
  const handlers = new Map<string, AcpPromptHandlers>();
  const permissions = new Map<
    string,
    {
      sessionId: string;
      resolve: (response: RequestPermissionResponse) => void;
    }
  >();
  let closed = false;
  const requireSession = (id: string) => {
    if (closed || !sessions.has(id))
      throw new Error("Unknown project session.");
  };
  const deny = (sessionId: string) => {
    for (const [id, permission] of permissions)
      if (permission.sessionId === sessionId) {
        permissions.delete(id);
        permission.resolve({ outcome: { outcome: "cancelled" } });
      }
  };
  const notify = async (message: SessionNotification) => {
    const current = handlers.get(message.sessionId);
    if (!current) return;
    const update = message.update;
    if (
      (update.sessionUpdate === "agent_message_chunk" ||
        update.sessionUpdate === "agent_thought_chunk") &&
      update.content.type === "text"
    ) {
      if (update.sessionUpdate === "agent_message_chunk")
        current.onAnswer(update.content.text);
      else current.onThought(update.content.text);
    }
    if (
      update.sessionUpdate === "tool_call" ||
      update.sessionUpdate === "tool_call_update"
    ) {
      current.onTool?.({
        type: "tool",
        sessionId: message.sessionId,
        id: update.toolCallId,
        title: update.title ?? "Tool",
        status: update.status ?? "pending",
        text:
          update.content
            ?.flatMap((c) =>
              c.type === "content" && c.content.type === "text"
                ? [c.content.text]
                : [],
            )
            .join("\n") ?? "",
      });
    }
  };
  return {
    async newSession(model) {
      if (closed) throw new Error("Project bridge is closed.");
      const created = await host.newSession(
        { cwd: project.cwd, mcpServers: [...(options.mcpServers?.() ?? [])] },
        {
          notify,
          requestPermission: (params) => {
            const current = handlers.get(params.sessionId);
            if (!current?.onPermission)
              return Promise.resolve({ outcome: { outcome: "cancelled" } });
            const id = randomUUID();
            return new Promise((resolve) => {
              permissions.set(id, { sessionId: params.sessionId, resolve });
              current.onPermission!({
                type: "tool/permission",
                sessionId: params.sessionId,
                id,
                title: params.toolCall.title ?? "Tool execution",
                text: JSON.stringify(params.toolCall.rawInput ?? {}, null, 2),
              });
            });
          },
        },
      );
      try {
        if (closed)
          throw new Error("Project bridge closed during session creation.");
        if (model !== undefined)
          host.control(created.sessionId, { action: "model", model });
        sessions.add(created.sessionId);
        return { sessionId: created.sessionId };
      } catch (error) {
        await host.closeSession(created.sessionId);
        throw error;
      }
    },
    async controlSession(id, control) {
      requireSession(id);
      return host.control(id, control);
    },
    async generateImage(id, prompt) {
      requireSession(id);
      return host.generateImage(id, prompt);
    },
    subscribeSession(id, listener) {
      requireSession(id);
      return host.subscribeSession(id, listener);
    },
    async prompt(id, text, current, signal, attachment) {
      requireSession(id);
      signal.throwIfAborted();
      if (handlers.has(id))
        throw new Error("Session already has an active turn.");
      const abort = () => {
        deny(id);
        host.sessionAgent(id).cancel({ sessionId: id });
      };
      handlers.set(id, current);
      signal.addEventListener("abort", abort, { once: true });
      try {
        await host.prompt(
          {
            sessionId: id,
            prompt: [
              { type: "text", text },
              ...(attachment === undefined
                ? []
                : [
                    {
                      type: "resource_link" as const,
                      uri: attachment.locator,
                      name: "chat-image",
                      mimeType: attachment.mediaType,
                    },
                  ]),
            ],
          },
          notify,
        );
      } finally {
        deny(id);
        handlers.delete(id);
        signal.removeEventListener("abort", abort);
      }
    },
    resolveToolPermission(id, permissionId, allow) {
      requireSession(id);
      const pending = permissions.get(permissionId);
      if (!pending || pending.sessionId !== id) return;
      permissions.delete(permissionId);
      pending.resolve({
        outcome: {
          outcome: "selected",
          optionId: allow ? "allow-once" : "reject-once",
        },
      });
    },
    cancel(id) {
      requireSession(id);
      deny(id);
      host.sessionAgent(id).cancel({ sessionId: id });
    },
    async closeSession(id) {
      requireSession(id);
      deny(id);
      await host.closeSession(id);
      sessions.delete(id);
    },
    async inspectMemory(query) {
      if (closed) throw new Error("Project bridge is closed.");
      return project.runtime.inspectMemory(query);
    },
    async ingestSource(input) {
      if (closed) throw new Error("Project bridge is closed.");
      return project.agent.ingestSource(input);
    },
    async close() {
      if (closed) return;
      closed = true;
      for (const id of sessions) deny(id);
      await host.close();
      sessions.clear();
      handlers.clear();
    },
  };
}
