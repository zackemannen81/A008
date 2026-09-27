import {
  createPlatformV3Client,
  loadModels,
  listSidebarProjects,
  DEFAULT_GUI_MODEL,
  type HttpClientOptions,
  type GuiSessionState,
  type SessionControl,
  type SessionSnapshot,
  type ToolPermissionDecision,
  type PromptImageAttachment,
} from "../../../packages/client/src/index.js";
import {
  requestJson,
  messageFromBody,
} from "../../../packages/client/src/http.js";
import {
  guiRunActivitySchema,
  guiConversationViewSchema,
  type PlatformV3Conversation,
  type PlatformV3Run,
  type ProjectSidebar,
  type WorkspaceSession,
} from "../../../packages/protocol/src/index.js";

export interface ChatSelection {
  projectId: string;
  conversationId?: string;
}
export interface SelectionStorage {
  read(): ChatSelection | undefined;
  write(value: ChatSelection): void;
}
export function browserChatSelection(): SelectionStorage {
  return {
    read() {
      try {
        const value = JSON.parse(
          sessionStorage.getItem("a008.durable-chat") ?? "null",
        );
        return value &&
          typeof value.projectId === "string" &&
          (value.conversationId === undefined ||
            typeof value.conversationId === "string")
          ? value
          : undefined;
      } catch {
        return undefined;
      }
    },
    write(value) {
      try {
        sessionStorage.setItem("a008.durable-chat", JSON.stringify(value));
      } catch {}
    },
  };
}

/** V3 SDK with the standalone GUI authentication boundary; no separate scheduler. */
export function durableChatHttp(http: HttpClientOptions): HttpClientOptions {
  return {
    ...http,
    fetch: (url, init) => {
      const target = url.startsWith("/")
        ? `/v1/chat${url}`
        : (() => {
            const parsed = new URL(url);
            parsed.pathname = `/v1/chat${parsed.pathname}`;
            return parsed.toString();
          })();
      return http.fetch(target, init);
    },
  };
}

export class DurableChatClient {
  readonly api;
  readonly #listeners = new Set<() => void>();
  #state: GuiSessionState = {
    status: "idle",
    sessionId: undefined,
    model: DEFAULT_GUI_MODEL,
    thought: "",
    answer: "",
    error: undefined,
    busy: false,
  };
  #selection: ChatSelection | undefined;
  #conversation: PlatformV3Conversation | undefined;
  #run: PlatformV3Run | undefined;
  #workspace: WorkspaceSession | undefined;
  #models: Awaited<ReturnType<typeof loadModels>> = [];
  #epoch = 0;
  #refreshVersion = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #disposed = false;
  #allowAll = new Set<string>();

  readonly http: HttpClientOptions;
  readonly storage: SelectionStorage;
  readonly pollMs: number;

  constructor(
    http: HttpClientOptions,
    storage: SelectionStorage = browserChatSelection(),
    pollMs = 700,
  ) {
    this.http = http;
    this.storage = storage;
    this.pollMs = pollMs;
    this.api = createPlatformV3Client(durableChatHttp(http));
    this.#selection = storage.read();
  }
  getSnapshot = () => this.#state;
  getWorkspace = () => this.#workspace;
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  #publish(patch: Partial<GuiSessionState>) {
    if (this.#disposed) return;
    this.#state = { ...this.#state, ...patch };
    for (const listener of this.#listeners) listener();
  }
  #error(error: unknown) {
    this.#publish({
      error: error instanceof Error ? error.message : "Chat request failed.",
    });
  }

  connect = async () => {
    this.#disposed = false;
    const epoch = ++this.#epoch;
    clearTimeout(this.#timer);
    this.#selection = this.storage.read();
    this.#publish({ status: "connecting", error: undefined });
    try {
      const models = await loadModels(this.http);
      if (epoch !== this.#epoch || this.#disposed) return;
      this.#models = models;
      if (
        !this.#models.some((model) => model.id === this.#state.model) &&
        this.#models[0]
      )
        this.#publish({ model: this.#models[0].id });
      const projects = await listSidebarProjects(this.http);
      if (epoch !== this.#epoch || this.#disposed) return;
      const projectId =
        this.#selection?.projectId ??
        projects.currentId ??
        projects.projects[0]?.projectId;
      if (projectId)
        await this.selectChat(projectId, this.#selection?.conversationId);
      else this.#publish({ status: "ready" });
    } catch (error) {
      if (epoch === this.#epoch) {
        this.#error(error);
        this.#publish({ status: "error" });
      }
    }
  };

  selectChat = async (
    projectId: string,
    conversationId?: string,
    create = false,
  ) => {
    const epoch = ++this.#epoch;
    clearTimeout(this.#timer);
    this.#conversation = undefined;
    this.#run = undefined;
    this.#workspace = undefined;
    this.#selection = { projectId };
    this.#publish({
      status: "connecting",
      sessionId: undefined,
      details: undefined,
      busy: false,
      permission: undefined,
      tools: [],
      thought: "",
      answer: "",
      pendingText: undefined,
      error: undefined,
    });
    try {
      const conversation = create
        ? (await this.api.createConversation(projectId, { title: "New chat" }))
            .conversation
        : conversationId
          ? (await this.api.getConversation(conversationId)).conversation
          : (await this.api.listConversations(projectId)).conversations.at(-1);
      if (epoch !== this.#epoch || this.#disposed) return;
      if (conversation && conversation.projectId !== projectId)
        throw new Error("Conversation belongs to another project.");
      this.#conversation = conversation;
      this.#selection = {
        projectId,
        ...(conversation ? { conversationId: conversation.id } : {}),
      };
      this.storage.write(this.#selection);
      this.#publish({ status: "ready", sessionId: conversation?.id });
      await this.refresh(epoch);
    } catch (error) {
      if (epoch === this.#epoch) {
        this.#error(error);
        this.#publish({ status: "error" });
      }
    }
  };

  sidebar = async (): Promise<ProjectSidebar> => {
    const sidebar = await listSidebarProjects(this.http);
    return {
      currentId: this.#selection?.projectId ?? null,
      projects: await Promise.all(
        sidebar.projects.map(async (project) => {
          const { conversations } = await this.api.listConversations(
            project.projectId,
          );
          return {
            ...project,
            conversations: await Promise.all(
              conversations.map(async (chat) => {
                const runId = [...chat.messages]
                  .reverse()
                  .find((message) => message.runId)?.runId;
                const run = runId
                  ? (await this.api.getRun(runId)).run
                  : undefined;
                const status =
                  run &&
                  [
                    "queued",
                    "running",
                    "cancel_requested",
                    "needs_reconciliation",
                  ].includes(run.status)
                    ? ` (${run.status.replaceAll("_", " ")})`
                    : "";
                return {
                  conversationId: chat.id,
                  title:
                    (chat.title === "New chat"
                      ? messageTitle(chat)
                      : chat.title) + status,
                  updatedAt: new Date(chat.updatedAt).toISOString(),
                  current: chat.id === this.#selection?.conversationId,
                };
              }),
            ),
          };
        }),
      ),
    };
  };

  refresh = async (epoch = this.#epoch): Promise<void> => {
    const version = ++this.#refreshVersion;
    clearTimeout(this.#timer);
    const id = this.#conversation?.id;
    if (!id || this.#disposed) return;
    try {
      const { response, body } = await requestJson(
        this.http,
        `/v1/chat/v3/conversations/${encodeURIComponent(id)}/view?model=${encodeURIComponent(this.#state.model)}`,
      );
      if (!response.ok)
        throw new Error(messageFromBody(body, "Cannot restore conversation."));
      const { conversation, runs, snapshot, workspace } =
        guiConversationViewSchema.parse(body);
      const run = runs.at(-1);
      const runId = run?.id;
      const active =
        run !== undefined &&
        ["queued", "running", "cancel_requested"].includes(run.status);
      const activity =
        runId && active ? await this.#activity(runId) : undefined;
      if (
        epoch !== this.#epoch ||
        version !== this.#refreshVersion ||
        this.#disposed
      )
        return;
      this.#conversation = conversation;
      this.#run = run;
      this.#workspace = workspace;
      const model = run?.model ?? this.#state.model;
      const details = snapshot as SessionSnapshot;
      this.#publish({
        status: "ready",
        model,
        details,
        busy: active,
        sessionId: id,
        thought: activity?.thought ?? "",
        answer: activity?.answer ?? "",
        tools: activity?.tools ?? [],
        permission: activity?.permission,
        pendingText: undefined,
        error:
          run?.status === "needs_reconciliation"
            ? "Execution outcome is uncertain; this run will not be replayed."
            : run?.error?.message,
      });
      if (activity?.permission && this.#allowAll.has(id))
        await this.#permission(runId!, activity.permission.id, true);
    } catch (error) {
      if (epoch === this.#epoch && version === this.#refreshVersion)
        this.#error(error);
    } finally {
      if (
        epoch === this.#epoch &&
        version === this.#refreshVersion &&
        !this.#disposed
      )
        this.#timer = setTimeout(() => {
          void this.refresh(epoch);
        }, this.pollMs);
    }
  };

  #activity = async (runId: string) => {
    const { response, body } = await requestJson(
      this.http,
      `/v1/chat/v3/runs/${encodeURIComponent(runId)}/activity`,
    );
    if (!response.ok)
      throw new Error(messageFromBody(body, "Cannot observe run."));
    return guiRunActivitySchema.parse(body);
  };
  #permission = async (runId: string, id: string, allow: boolean) => {
    const { response, body } = await requestJson(
      this.http,
      `/v1/chat/v3/runs/${encodeURIComponent(runId)}/permission`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, allow }),
      },
    );
    if (!response.ok)
      throw new Error(messageFromBody(body, "Permission decision failed."));
  };
  resolveToolPermission = (decision: ToolPermissionDecision) => {
    const run = this.#run,
      permission = this.#state.permission;
    if (!run || !permission) return;
    if (decision === "allow_all") this.#allowAll.add(run.conversationId);
    void this.#permission(run.id, permission.id, decision !== "reject")
      .then(() => this.refresh())
      .catch((error) => this.#error(error));
  };

  prompt = async (text: string, attachment?: PromptImageAttachment) => {
    if (attachment)
      throw new Error(
        "Image attachments are not yet supported by durable runs.",
      );
    if (this.#state.status !== "ready")
      throw new Error("Wait for the selected chat to finish opening.");
    if (this.#state.busy)
      throw new Error("This conversation already has an active run.");
    if (!this.#selection) throw new Error("Select a project first.");
    if (!this.#conversation) {
      const opening = this.selectChat(
        this.#selection.projectId,
        undefined,
        true,
      );
      const epoch = this.#epoch;
      await opening;
      if (epoch !== this.#epoch)
        throw new Error(
          "Chat selection changed before submission. Send from the intended chat.",
        );
    }
    const conversation = this.#conversation;
    if (!conversation)
      throw new Error("Could not create an isolated conversation workspace.");
    const epoch = this.#epoch;
    this.#refreshVersion++;
    clearTimeout(this.#timer);
    this.#publish({ busy: true, error: undefined });
    try {
      await this.api.createRun(conversation.id, {
        commandId: crypto.randomUUID(),
        expectedRevision: conversation.revision,
        model: this.#state.model,
        text,
      });
      if (epoch === this.#epoch) await this.refresh(epoch);
    } catch (error) {
      if (epoch === this.#epoch) {
        this.#publish({ busy: false });
        this.#error(error);
      }
      throw error;
    }
  };
  cancel = async () => {
    const run = this.#run;
    if (!run) return;
    const epoch = this.#epoch;
    const current = (await this.api.getRun(run.id)).run;
    await this.api.cancelRun(run.id, { expectedRevision: current.revision });
    if (epoch === this.#epoch) await this.refresh(epoch);
  };
  controlSession = async (
    control: SessionControl,
  ): Promise<SessionSnapshot> => {
    if (control.action === "reset") {
      if (!this.#selection) throw new Error("Select a project first.");
      await this.selectChat(this.#selection.projectId, undefined, true);
    } else if (control.action === "model") {
      if (this.#state.busy)
        throw new Error(
          "Select a new chat to change model while this run is active.",
        );
      if (!this.#models.some((model) => model.id === control.model))
        throw new Error("Unknown model.");
      this.#publish({ model: control.model });
      // A new conversation preserves the old model's committed history.
      if (this.#selection)
        await this.selectChat(this.#selection.projectId, undefined, true);
    } else if (control.action !== "inspect")
      throw new Error("This control is unavailable for durable conversations.");
    if (!this.#state.details) throw new Error("Select a conversation first.");
    return this.#state.details;
  };
  endSession = async () => {
    this.dispose();
  };
  dispose = () => {
    this.#disposed = true;
    this.#epoch++;
    clearTimeout(this.#timer);
  };
}

function messageTitle(conversation: PlatformV3Conversation): string {
  const content = conversation.messages.find(
    (message) => message.role === "user",
  )?.content;
  return typeof content === "string"
    ? content.slice(0, 70)
    : conversation.title;
}
