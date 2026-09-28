import { randomUUID } from "node:crypto";
import type { RequestPermissionResponse } from "@agentclientprotocol/sdk";
import { EngineHost } from "../engine/engine-host.js";
import type {
  ProjectRuntime,
  ProjectRuntimeRegistry,
} from "../engine/project-runtime-registry.js";
import { defaultCatalogPath } from "../core/user-catalog.js";
import { configuredMcpServers } from "../gui-host/provider-routes.js";
import type { SessionSnapshot } from "../core/session-control.js";
import type { GuiHostServerMessage } from "../gui-host/protocol.js";
import type {
  PlatformTextHistoryMessage,
  PlatformTextTurnResult,
} from "./runtime-adapter.js";
import type { ChatContentPart } from "../core/types.js";
import type { PromptImageAttachment, SessionParameters } from "../../packages/protocol/src/index.js";

export const PLATFORM_GUI_OWNER = "owner_gui";
type Tool = Extract<GuiHostServerMessage, { type: "tool" }>;
export interface GuiRunActivity {
  readonly snapshot?: SessionSnapshot;
  readonly thought: string;
  readonly answer: string;
  readonly tools: readonly Tool[];
  readonly permission?: { id: string; title: string; text: string };
}

/** One coordinator-owned EngineHost/tool session. Observers never close it. */
export class GuiRunSession {
  readonly #host: EngineHost;
  #sessionId: string | undefined;
  #snapshot: SessionSnapshot | undefined;
  #thought = "";
  #answer = "";
  #tools = new Map<string, Tool>();
  #permission: GuiRunActivity["permission"];
  #resolve: ((response: RequestPermissionResponse) => void) | undefined;

  constructor(
    readonly input: {
      project: ProjectRuntime;
      registry: ProjectRuntimeRegistry;
      env: NodeJS.ProcessEnv;
      cwd: string;
      model: string;
      parameters: SessionParameters;
      conversationId: string;
      history: readonly PlatformTextHistoryMessage[];
      onActivity?: (activity: GuiRunActivity) => void;
      recoveryRequired?: boolean;
    },
  ) {
    this.#host = new EngineHost({
      env: input.env,
      registry: input.registry,
      createPanels: false,
      resolveProject: () => input.project,
    });
  }

  activity(): GuiRunActivity {
    return {
      ...(this.#snapshot ? { snapshot: this.#snapshot } : {}),
      thought: this.#thought,
      answer: this.#answer,
      tools: [...this.#tools.values()],
      ...(this.#permission ? { permission: this.#permission } : {}),
    };
  }

  permission(id: string, allow: boolean): boolean {
    if (this.#permission?.id !== id) return false;
    const resolve = this.#resolve;
    this.#permission = undefined;
    this.#resolve = undefined;
    resolve?.({
      outcome: {
        outcome: "selected",
        optionId: allow ? "allow-once" : "reject-once",
      },
    });
    return true;
  }

  async complete(
    text: string,
    signal: AbortSignal,
    attachment?: PromptImageAttachment,
  ): Promise<PlatformTextTurnResult> {
    const abort = () => {
      this.#resolve?.({ outcome: { outcome: "cancelled" } });
      this.#permission = undefined;
      this.#resolve = undefined;
      if (this.#sessionId)
        this.#host
          .sessionAgent(this.#sessionId)
          .cancel({ sessionId: this.#sessionId });
    };
    let failed = false;
    let memoryStatus: PlatformTextTurnResult["memoryStatus"] = "unknown";
    try {
      const created = await this.#host.newSession(
        {
          cwd: this.input.cwd,
          mcpServers: [
            ...configuredMcpServers(defaultCatalogPath(this.input.env)),
          ],
        },
        {
          requestPermission: (params) => {
            if (
              this.input.recoveryRequired &&
              !["read_file", "list_files"].includes(params.toolCall.title ?? "")
            )
              return Promise.resolve({
                outcome: {
                  outcome: "selected" as const,
                  optionId: "reject-once",
                },
              });
            return new Promise((resolve) => {
              this.#resolve = resolve;
              this.#permission = {
                id: randomUUID(),
                title: params.toolCall.title ?? "Tool execution",
                text: JSON.stringify(params.toolCall.rawInput ?? {}),
              };
              this.input.onActivity?.(this.activity());
              if (signal.aborted) abort();
            });
          },
        },
        {
          initialModel: this.input.model,
          conversationSeed: {
            conversationId: this.input.conversationId,
            messages: this.input.history,
          },
        },
      );
      this.#sessionId = created.sessionId;
      this.#snapshot = this.#host.control(created.sessionId, {
        action: "configure",
        parameters: this.input.parameters,
      });
      this.#host.subscribeSession(created.sessionId, (message) => {
        if (message.type === "session/activity" && message.state)
          this.#snapshot = message.state;
        if (message.type === "answer") this.#answer += message.text;
        if (message.type === "thought") this.#thought += message.text;
        if (message.type === "tool") this.#tools.set(message.id, message);
        this.input.onActivity?.(this.activity());
      });
      signal.throwIfAborted();
      signal.addEventListener("abort", abort, { once: true });
      try {
        const result = await this.#host.prompt(
          {
            sessionId: created.sessionId,
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
          async () => {},
        );
        const status = result._meta?.["a008.memoryStatus"];
        memoryStatus =
          status === "completed"
            ? "completed"
            : [
                  "staging_failed",
                  "commit_failed",
                  "index_repair_required",
                ].includes(String(status))
              ? "failed"
              : "unknown";
      } catch {
        failed = true;
      }
      await this.#host.settleGeneratedImages(created.sessionId, signal);
      const snapshot = this.#host.control(created.sessionId, {
        action: "inspect",
      });
      this.#snapshot = snapshot;
      this.input.onActivity?.(this.activity());
      const before = this.input.history.filter(
        (message) => message.role === "assistant",
      ).length;
      const assistants = snapshot.messages.filter(
        (message) => message.role === "assistant",
      );
      const fresh = assistants.slice(before);
      const answer =
        fresh.length <= 1
          ? fresh[0]?.content
          : fresh.flatMap((message): readonly ChatContentPart[] =>
              typeof message.content === "string"
                ? [{ type: "text", text: message.content }]
                : message.content,
            );
      return {
        answer,
        memoryStatus:
          answer === undefined ? "unknown" : failed ? "failed" : memoryStatus,
      };
    } finally {
      signal.removeEventListener("abort", abort);
      this.#resolve?.({ outcome: { outcome: "cancelled" } });
      this.#permission = undefined;
      this.#resolve = undefined;
      await this.#host.close();
    }
  }
}
