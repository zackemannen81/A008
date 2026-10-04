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
  runtimePreferencesSnapshotSchema,
  type RuntimePreferencesSnapshot,
  type PlatformV3Conversation,
  type PlatformV3Run,
  type ProjectSidebar,
  type WorkspaceSession,
  type GuiRunActivity,
  type GuiConversationView,
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

import { RunOutcomeTracker, playOutcomeTone, type RunOutcome } from "./run-notifications.js";
import { readDefaultChatModel } from "../onboarding/setup-state.js";

export class DurableChatClient {
  readonly api;
  readonly #listeners = new Set<() => void>();
  readonly #runOutcomeTracker = new RunOutcomeTracker();
  #state: GuiSessionState = {
    status: "idle",
    sessionId: undefined,
    model: readDefaultChatModel() ?? DEFAULT_GUI_MODEL,
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
  #runtimePreferences: RuntimePreferencesSnapshot | undefined;
  #epoch = 0;
  #refreshVersion = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #disposed = false;
  #allowAll = new Set<string>();
  #observer: { runId: string; abort: AbortController } | undefined;
  #liveActivity: GuiRunActivity | undefined;
  #durableSnapshot: GuiConversationView["snapshot"] | undefined;
  #submittedRun: string | undefined;
  #permissionRequests = new Map<string, Promise<void>>();
  #progressRunId: string | undefined;
  #progressFingerprint = "";
  #lastProgressAt = 0;
  // Keep confirmed decisions across chat switches; stale snapshots can outlive POSTs.
  #resolvedPermissions = new Set<string>();

  #runObservation(
    run: PlatformV3Run,
    activity?: GuiRunActivity,
  ) {
    const fingerprint = JSON.stringify([
      run.status,
      activity?.liveRevision,
      activity?.cursor,
      activity?.answer.length,
      activity?.tools.map((tool) => [
        tool.id,
        tool.status,
        tool.text.length,
        tool.outcome,
      ]),
      activity?.permission?.id,
    ]);
    if (this.#progressRunId !== run.id) {
      this.#progressRunId = run.id;
      this.#progressFingerprint = fingerprint;
      this.#lastProgressAt = Date.now();
    } else if (this.#progressFingerprint !== fingerprint) {
      this.#progressFingerprint = fingerprint;
      this.#lastProgressAt = Date.now();
    }
    return {
      id: run.id,
      status: run.status,
      model: run.model,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      leaseGeneration: run.leaseGeneration,
      lastProgressAt: this.#lastProgressAt || Date.now(),
      ...(activity?.liveRevision ? { liveRevision: activity.liveRevision } : {}),
      ...(activity?.cursor === undefined ? {} : { cursor: activity.cursor }),
    };
  }

  #pendingPermission(runId: string, permission: GuiRunActivity["permission"]) {
    return permission &&
      !this.#resolvedPermissions.has(JSON.stringify([runId, permission.id]))
      ? permission
      : undefined;
  }

  #stopObserver() {
    this.#observer?.abort.abort();
    this.#observer = undefined;
    this.#liveActivity = undefined;
  }
  #details(
    snapshot: GuiConversationView["snapshot"],
    activity?: GuiRunActivity,
  ): SessionSnapshot {
    const live = activity?.snapshot;
    // A process snapshot may still contain only the history preceding this run.
    // Admit its transient suffix only after it includes the full durable prefix.
    const hasPrefix =
      live &&
      snapshot.messages.every((message, index) => {
        const candidate = live.messages[index];
        return (
          candidate?.role === message.role &&
          JSON.stringify(candidate.content) === JSON.stringify(message.content)
        );
      });
    return {
      ...snapshot,
      ...(live ?? {}),
      messages: hasPrefix
        ? [
            ...snapshot.messages,
            ...live.messages.slice(snapshot.messages.length),
          ]
        : snapshot.messages,
      ...(this.#runtimePreferences
        ? { runtimePreferences: this.#runtimePreferences }
        : {}),
    } as SessionSnapshot;
  }
  #observe(runId: string, epoch: number, initial: GuiRunActivity) {
    if (this.#observer?.runId === runId || !initial.liveRevision) return;
    this.#stopObserver();
    const abort = new AbortController();
    const observer = { runId, abort };
    this.#observer = observer;
    this.#liveActivity = initial;
    void (async () => {
      let revision = initial.liveRevision;
      try {
        while (
          !abort.signal.aborted &&
          epoch === this.#epoch &&
          !this.#disposed
        ) {
          const activity = await this.#activity(runId, revision, abort.signal);
          if (
            abort.signal.aborted ||
            epoch !== this.#epoch ||
            this.#observer !== observer ||
            !activity?.liveRevision
          )
            return;
          revision = activity.liveRevision;
          this.#liveActivity = activity;
          if (this.#run?.id !== runId || !this.#state.busy) return;
          const permission = this.#pendingPermission(
            runId,
            activity.permission,
          );
          const autoAllow =
            !!permission && this.#allowAll.has(this.#run.conversationId);
          this.#publish({
            ...(this.#durableSnapshot
              ? { details: this.#details(this.#durableSnapshot, activity) }
              : {}),
            ...(this.#run ? { run: this.#runObservation(this.#run, activity) } : {}),
            thought: activity.thought,
            answer: activity.answer,
            tools: activity.tools,
            permission: autoAllow ? undefined : permission,
          });
          if (autoAllow && permission)
            await this.#permission(runId, permission.id, true);
        }
      } catch {
        // The regular view refresh restores state/reconnects; never retry a run.
      } finally {
        if (this.#observer === observer) this.#stopObserver();
      }
    })();
  }

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
  getSelectedProjectId = () => this.#selection?.projectId;
  getRuntimePreferences = () => this.#runtimePreferences;
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
  #loadRuntimePreferences = async (): Promise<RuntimePreferencesSnapshot> => {
    const { response, body } = await requestJson(
      this.http,
      "/v1/runtime-preferences",
    );
    if (!response.ok)
      throw new Error(messageFromBody(body, "Cannot load global settings."));
    const parsed = runtimePreferencesSnapshotSchema.safeParse(body);
    if (!parsed.success)
      throw new Error("Host returned invalid global settings.");
    this.#runtimePreferences = parsed.data;
    return parsed.data;
  };
  #saveRuntimePreferences = async (
    settings: unknown,
    revision: string,
  ): Promise<RuntimePreferencesSnapshot> => {
    const { response, body } = await requestJson(
      this.http,
      "/v1/runtime-preferences",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings, revision }),
      },
    );
    if (!response.ok)
      throw new Error(messageFromBody(body, "Cannot save global settings."));
    const parsed = runtimePreferencesSnapshotSchema.safeParse(body);
    if (!parsed.success)
      throw new Error("Host returned invalid saved global settings.");
    this.#runtimePreferences = parsed.data;
    return parsed.data;
  };

  connect = async () => {
    this.#stopObserver();
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
      await this.#loadRuntimePreferences();
      if (epoch !== this.#epoch || this.#disposed) return;
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
    const createParameters =
      this.#state.details?.model === this.#state.model
        ? this.#state.details.parameters
        : this.#models.find((model) => model.id === this.#state.model)
            ?.defaults;
    const epoch = ++this.#epoch;
    clearTimeout(this.#timer);
    this.#conversation = undefined;
    this.#stopObserver();
    this.#durableSnapshot = undefined;
    this.#submittedRun = undefined;
    this.#run = undefined;
    this.#workspace = undefined;
    this.#progressRunId = undefined;
    this.#progressFingerprint = "";
    this.#lastProgressAt = 0;
    this.#selection = { projectId };
    this.#publish({
      status: "connecting",
      sessionId: undefined,
      details: undefined,
      process: undefined,
      recovery: undefined,
      busy: false,
      permission: undefined,
      tools: [],
      thought: "",
      answer: "",
      pendingText: undefined,
      pendingTextUncommitted: false,
      error: undefined,
    });
    try {
      const conversation = create
        ? (
            await this.api.createConversation(projectId, {
              title: "New chat",
              model: this.#state.model,
              ...(createParameters === undefined
                ? {}
                : { parameters: createParameters }),
            })
          ).conversation
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
      const { conversation, runs, snapshot, workspace, process } =
        guiConversationViewSchema.parse(body);
      const run = runs.at(-1);
      const runId = run?.id;
      const active =
        run !== undefined &&
        ["queued", "running", "cancel_requested"].includes(run.status);
      const activity = runId
        ? active && this.#observer?.runId === runId && this.#liveActivity
          ? this.#liveActivity
          : await this.#activity(runId)
        : undefined;
      if (
        epoch !== this.#epoch ||
        version !== this.#refreshVersion ||
        this.#disposed
      )
        return;
      this.#conversation = conversation;
      this.#run = run;
      this.#workspace = workspace ?? undefined;
      const permission = runId
        ? this.#pendingPermission(runId, activity?.permission)
        : undefined;
      const autoAllow = permission !== undefined && this.#allowAll.has(id);
      if (autoAllow && runId)
        await this.#permission(runId, permission.id, true);
      if (
        epoch !== this.#epoch ||
        version !== this.#refreshVersion ||
        this.#disposed
      )
        return;
      const model = snapshot.model;
      this.#durableSnapshot = snapshot;
      const currentActivity =
        active && this.#observer?.runId === runId
          ? (this.#liveActivity ?? activity)
          : activity;
      const details = this.#details(
        snapshot,
        active ? currentActivity : undefined,
      );
      const accepted =
        this.#submittedRun !== undefined &&
        conversation.messages.some(
          (message) =>
            message.runId === this.#submittedRun && message.role === "user",
        );
      if (accepted) this.#submittedRun = undefined;
      this.#publish({
        status: "ready",
        model,
        details,
        busy: active,
        run: run ? this.#runObservation(run, currentActivity) : undefined,
        sessionId: id,
        process,
        recovery: runs
          .filter((entry) => entry.status === "needs_reconciliation")
          .map((entry) => ({ runId: entry.id, revision: entry.revision })),
        thought: currentActivity?.thought ?? "",
        answer: currentActivity?.answer ?? "",
        tools: currentActivity?.tools ?? [],
        permission:
          this.#allowAll.has(id) || !runId
            ? undefined
            : this.#pendingPermission(runId, currentActivity?.permission),
        pendingText: accepted ? undefined : this.#state.pendingText,
        pendingTextUncommitted: accepted
          ? false
          : this.#state.pendingTextUncommitted,
        error:
          run?.status === "needs_reconciliation"
            ? "Execution outcome is uncertain; this run will not be replayed."
            : this.#state.pendingTextUncommitted && !accepted
              ? (this.#state.error ?? run?.error?.message)
              : run?.error?.message,
      });
      if (active && runId && currentActivity)
        this.#observe(runId, epoch, currentActivity);
      else this.#stopObserver();
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

  stopProcess = async (): Promise<void> => {
    try {
      if (!this.#conversation) return;
      const { response, body } = await requestJson(
        this.http,
        `/v1/chat/v3/conversations/${encodeURIComponent(this.#conversation.id)}/process`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        this.#error(
          new Error(messageFromBody(body, "Cannot stop session process.")),
        );
        return;
      }
      await this.refresh();
    } catch (error) {
      this.#error(error);
    }
  };
  acknowledgeEffects = async (): Promise<void> => {
    try {
      for (const run of this.#state.recovery ?? []) {
        const { response, body } = await requestJson(
          this.http,
          `/v1/chat/v3/runs/${encodeURIComponent(run.runId)}/effect-review`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              expectedRevision: run.revision,
              effectsReviewed: true,
            }),
          },
        );
        if (!response.ok) {
          this.#error(
            new Error(messageFromBody(body, "Cannot record effect review.")),
          );
          return;
        }
      }
      await this.refresh();
    } catch (error) {
      this.#error(error);
    }
  };

  #activity = async (
    runId: string,
    afterLive?: string,
    signal?: AbortSignal,
  ) => {
    const { response, body } = await requestJson(
      this.http,
      `/v1/chat/v3/runs/${encodeURIComponent(runId)}/activity${afterLive === undefined ? "" : `?afterLive=${encodeURIComponent(afterLive)}`}`,
      { ...(signal ? { signal } : {}) },
    );
    if (response.status === 404) return undefined;
    if (!response.ok)
      throw new Error(messageFromBody(body, "Cannot observe run."));
    return guiRunActivitySchema.parse(body);
  };
  #permission = async (runId: string, id: string, allow: boolean) => {
    const key = JSON.stringify([runId, id]);
    if (this.#resolvedPermissions.has(key)) return;
    const pending = this.#permissionRequests.get(key);
    if (pending) return pending;
    const request = this.#sendPermission(runId, id, allow)
      .then(() => {
        this.#resolvedPermissions.add(key);
        if (this.#run?.id === runId && this.#state.permission?.id === id)
          this.#publish({ permission: undefined });
      })
      .finally(() => {
        this.#permissionRequests.delete(key);
      });
    this.#permissionRequests.set(key, request);
    return request;
  };
  #sendPermission = async (runId: string, id: string, allow: boolean) => {
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
      this.#publish({
        pendingText: text,
        pendingTextUncommitted: true,
        busy: true,
        thought: "",
        answer: "",
      });
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
    this.#stopObserver();
    this.#submittedRun = undefined;
    this.#publish({
      busy: true,
      pendingText: text,
      pendingTextUncommitted: true,
      thought: "",
      answer: "",
      tools: [],
      error: undefined,
    });
    try {
      const { run } = await this.api.createRun(conversation.id, {
        commandId: crypto.randomUUID(),
        expectedRevision: conversation.revision,
        model: this.#state.model,
        text,
        ...(attachment === undefined ? {} : { attachment }),
      });
      if (epoch === this.#epoch) {
        this.#submittedRun = run.id;
        await this.refresh(epoch);
      }
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
    } else if (control.action === "configure") {
      if (this.#state.busy)
        throw new Error("Cannot configure during an active run.");
      if (!this.#conversation) throw new Error("Select a conversation first.");
      const configured = await this.api.configureConversation(
        this.#conversation.id,
        {
          expectedRevision: this.#conversation.revision,
          model: this.#state.model,
          parameters: control.parameters,
        },
      );
      this.#conversation = configured.conversation;
      if (!this.#state.details) throw new Error("Select a conversation first.");
      const details = {
        ...this.#state.details,
        model: this.#state.model,
        parameters: control.parameters,
      };
      this.#publish({ details });
      return details;
    } else if (control.action === "configureRuntime") {
      const preferences = await this.#saveRuntimePreferences(
        control.settings,
        control.revision,
      );
      if (!this.#state.details) throw new Error("Select a conversation first.");
      const details = {
        ...this.#state.details,
        runtimePreferences: preferences,
      };
      this.#publish({ details });
      return details;
    } else if (control.action === "inspect") {
      const preferences = await this.#loadRuntimePreferences();
      if (!this.#state.details) throw new Error("Select a conversation first.");
      const details = {
        ...this.#state.details,
        runtimePreferences: preferences,
      };
      this.#publish({ details });
      return details;
    } else {
      throw new Error("This control is unavailable for durable conversations.");
    }
    if (!this.#state.details) throw new Error("Select a conversation first.");
    return this.#state.details;
  };
  endSession = async () => {
    this.dispose();
  };
  dispose = () => {
    this.#stopObserver();
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
