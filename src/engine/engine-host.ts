import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type {
  InitializeRequest,
  NewSessionRequest,
  PromptRequest,
  SessionNotification,
} from "@agentclientprotocol/sdk";
import {
  A008AcpAgent,
  parseSharedMemoryCapabilitiesParams,
} from "../acp/A008-acp-agent.js";
import {
  ProjectRuntimeRegistry,
  type ProjectRuntime,
} from "./project-runtime-registry.js";
import type {
  SessionControl,
  SessionSnapshot,
} from "../core/session-control.js";
import type { ChatMessage } from "../core/types.js";
import type { GeneratedImage } from "../../packages/protocol/src/index.js";
import { defaultCatalogPath } from "../core/user-catalog.js";
import {
  defaultSecretsPath,
  resolveKieApiKey,
  resolveNvidiaApiKey,
} from "../core/provider-secrets.js";
import { handleImageGenerate } from "../gui-host/provider-routes.js";
import { startGuiHost, type GuiHost } from "../gui-host/server.js";
import type { AcpBridge } from "../gui-host/acp-bridge.js";
import type { GuiHostServerMessage } from "../gui-host/protocol.js";
import { ModelToolSession } from "../tools/model-tools.js";
import {
  prepareAcpTools,
  type RequestToolPermission,
  type ToolNotifier,
} from "../tools/acp-tools.js";

type Project = ProjectRuntime;
type Listener = (message: GuiHostServerMessage) => void;
interface EngineSession {
  project: Project;
  cwd: string;
  panel?: GuiHost;
  tools: ModelToolSession;
  requestPermission?: RequestToolPermission;
  notify?: ToolNotifier;
  listeners: Set<Listener>;
  active?: Promise<unknown>;
  input?: string;
  thought: string;
  answer: string;
  activities: Map<string, Extract<GuiHostServerMessage, { type: "tool" }>>;
  generations: Map<string, AbortController>;
}

export interface EngineConversationSeed {
  readonly conversationId: string;
  readonly messages: readonly ChatMessage[];
}

export interface EngineNewSessionOptions {
  readonly initialModel?: string;
  readonly workspaceConversation?: boolean;
  /** Trusted backend composition only; never decoded from ACP/WebSocket input. */
  readonly conversationSeed?: EngineConversationSeed;
}

export interface EngineHostOptions {
  /** Internal standalone facade: bind sessions to this resolver without panels. */
  resolveProject?: (cwd: string) => ProjectRuntime;
  createPanels?: boolean;
  /** Borrowed registry; the caller disposes it after all hosts/sessions close. */
  registry?: ProjectRuntimeRegistry;
  env: NodeJS.ProcessEnv;
  cwd?: string;
  stderr?: NodeJS.WritableStream;
  staticDir?: string;
  /** Test/embedding override. Production uses configured A008 image providers. */
  generateImage?: (input: {
    project: ProjectRuntime;
    prompt: string;
    signal: AbortSignal;
  }) => Promise<GeneratedImage>;
}

/** ACP and web panels share these exact runtime/session objects. */
export class EngineHost {
  readonly #options: EngineHostOptions;
  readonly #registry: ProjectRuntimeRegistry;
  readonly #ownsRegistry: boolean;
  readonly #projects = new Map<string, Project>();
  readonly #sessions = new Map<string, EngineSession>();
  readonly #initializing = new Set<Promise<unknown>>();
  #closed = false;

  constructor(options: EngineHostOptions) {
    this.#options = options;
    this.#ownsRegistry = options.registry === undefined;
    this.#registry =
      options.registry ??
      new ProjectRuntimeRegistry({
        env: options.env,
        ...(options.stderr ? { stderr: options.stderr } : {}),
      });
  }

  initialize(params: InitializeRequest) {
    const agent = new A008AcpAgent({
      sessionControls: true,
      createSession() {
        throw new Error("Create a project session first.");
      },
    });
    const response = agent.initialize(params);
    return {
      ...response,
      agentInfo: {
        ...response.agentInfo,
        name: "A008",
        title: "A008 Engine",
        version: "0.0.0",
      },
      agentCapabilities: {
        ...response.agentCapabilities,
        _meta: { ...response.agentCapabilities?._meta, "engine.panels": 1 },
      },
    };
  }

  newSession(
    params: NewSessionRequest,
    client: {
      requestPermission?: RequestToolPermission;
      notify?: ToolNotifier;
    } = {},
    options: EngineNewSessionOptions = {},
  ) {
    const work = this.#newSession(params, client, options);
    this.#initializing.add(work);
    void work
      .finally(() => this.#initializing.delete(work))
      .catch(() => undefined);
    return work;
  }

  async #newSession(
    params: NewSessionRequest,
    client: {
      requestPermission?: RequestToolPermission;
      notify?: ToolNotifier;
    },
    options: EngineNewSessionOptions,
  ) {
    if (this.#closed) throw new Error("Engine is stopping.");
    const project = this.#project(params.cwd);
    const cwd = params.cwd;
    const created = project.agent.newSession(params, {
      ...(options.initialModel === undefined
        ? {}
        : { initialModel: options.initialModel }),
      ...(options.workspaceConversation === undefined
        ? {}
        : { workspaceConversation: options.workspaceConversation }),
      ...(options.conversationSeed === undefined
        ? {}
        : { conversationSeed: options.conversationSeed }),
    });
    const tools = new ModelToolSession({
      cwd,
      env: this.#options.env,
      mcpServers: params.mcpServers,
      generateImage: async (prompt, signal) => {
        signal.throwIfAborted();
        this.generateImage(created.sessionId, prompt);
      },
    });
    const token = randomBytes(32).toString("hex");
    const session: EngineSession = {
      project,
      cwd,
      ...client,
      tools,
      listeners: new Set(),
      activities: new Map(),
      generations: new Map(),
      thought: "",
      answer: "",
    };
    this.#sessions.set(created.sessionId, session);
    try {
      // Enable controls before either client uses the session; a configuration
      // failure must still pass through the session/tool cleanup below.
      project.agent.controlSession({
        sessionId: created.sessionId,
        action: "inspect",
      });
      if (this.#options.createPanels === false)
        return { ...created, _meta: { "engine.panels": [] } };
      session.panel = await startGuiHost({
        host: "127.0.0.1",
        port: 0,
        accessToken: token,
        env: this.#options.env,
        cwd,
        sourceStorePath: project.runtime.sourceStoreRoot!,
        staticDir:
          this.#options.staticDir ??
          fileURLToPath(new URL("../../../gui/dist", import.meta.url)),
        createAcpBridge: () => this.#panelBridge(created.sessionId, session),
      });
      if (this.#closed)
        throw new Error("Engine stopped during session creation.");
      return {
        ...created,
        _meta: {
          "engine.panels": [
            {
              id: "a008",
              title: "A008",
              sessionId: created.sessionId,
              url: `http://127.0.0.1:${session.panel.port}/#engine=${token}`,
            },
          ],
        },
      };
    } catch (error) {
      this.#sessions.delete(created.sessionId);
      project.agent.closeSession({ sessionId: created.sessionId });
      await session.panel?.close();
      await session.tools.close();
      throw error;
    }
  }

  sessionAgent(sessionId: string) {
    return this.#require(sessionId).project.agent;
  }

  subscribeSession(sessionId: string, listener: Listener): () => void {
    const session = this.#require(sessionId);
    session.listeners.add(listener);
    listener({
      type: "session/activity",
      sessionId,
      active: !!session.active,
      ...(session.input ? { text: session.input } : {}),
      state: this.#state(sessionId, session),
    });
    if (session.active) {
      if (session.thought)
        listener({ type: "thought", sessionId, text: session.thought });
      if (session.answer)
        listener({ type: "answer", sessionId, text: session.answer });
    }
    for (const activity of session.activities.values()) listener(activity);
    return () => session.listeners.delete(listener);
  }

  generateImage(
    sessionId: string,
    prompt: string,
  ): { generationId: string; state: SessionSnapshot } {
    const session = this.#require(sessionId);
    const normalized = prompt.trim();
    if (normalized.length < 3)
      throw new Error("Image prompt must be at least 3 characters.");
    const generationId = "image_" + randomUUID();
    const state = this.#withWorkspaceCwd(
      session,
      session.project.agent.reserveGeneratedImage(
        sessionId,
        generationId,
        normalized,
      ),
    );
    const controller = new AbortController();
    session.generations.set(generationId, controller);
    this.#emit(session, {
      type: "session/activity",
      sessionId,
      active: !!session.active,
      state,
    });
    void this.#completeGeneratedImage(
      sessionId,
      generationId,
      normalized,
      controller,
    );
    return { generationId, state };
  }

  #project(directory: string): Project {
    if (this.#closed) throw new Error("Engine is stopping.");
    const project =
      this.#options.resolveProject?.(directory) ??
      this.#registry.openEngine(directory);
    this.#projects.set(project.cwd, project);
    return project;
  }

  sharedMemoryCapabilities(params: unknown) {
    parseSharedMemoryCapabilitiesParams(params);
    return {
      protocol: "A007_MEMORY_V1",
      version: 1,
      capabilities: [
        "recall",
        "write",
        "provenance",
        "lexical",
        "deterministic",
        "project-scoped",
        "durable",
      ],
      projectId: null,
      projectSelection: "session-or-absolute-cwd",
      durable: true,
      writeSemantics: "evidence",
    };
  }

  projectAgent(params: unknown) {
    const input =
      params && typeof params === "object"
        ? (params as Record<string, unknown>)
        : {};
    if (typeof input.sessionId === "string")
      return this.sessionAgent(input.sessionId);
    if (typeof input.cwd === "string") return this.#project(input.cwd).agent;
    // Felix's existing local project identifier carries the absolute workspace.
    if (
      typeof input.projectId === "string" &&
      input.projectId.startsWith("local:")
    )
      return this.#project(input.projectId.slice(6)).agent;
    const projects = [...this.#projects.values()];
    const project =
      typeof input.projectId === "string"
        ? projects.find((p) => p.runtime.projectId === input.projectId)
        : projects.length === 1
          ? projects[0]
          : undefined;
    if (!project)
      throw new Error("Select a project session before using engine memory.");
    return project.agent;
  }

  async prompt(
    params: PromptRequest,
    notify: (message: SessionNotification) => Promise<void>,
  ) {
    const session = this.#require(params.sessionId);
    if (session.active) throw new Error("Session already has an active turn.");
    session.input = params.prompt
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n");
    session.thought = "";
    session.answer = "";
    session.activities.clear();
    this.#emit(session, {
      type: "session/activity",
      sessionId: params.sessionId,
      active: true,
      text: session.input,
    });
    const publish: ToolNotifier = async (message) => {
      const update = message.update;
      if (
        update.sessionUpdate === "tool_call" ||
        update.sessionUpdate === "tool_call_update"
      ) {
        const previous = session.activities.get(update.toolCallId);
        const activity = {
          type: "tool" as const,
          sessionId: params.sessionId,
          id: update.toolCallId,
          title: update.title ?? previous?.title ?? "Tool",
          status: update.status ?? previous?.status ?? "pending",
          text:
            update.content
              ?.flatMap((c) =>
                c.type === "content" && c.content.type === "text"
                  ? [c.content.text]
                  : [],
              )
              .join("\n") ??
            previous?.text ??
            "",
        };
        session.activities.set(activity.id, activity);
        this.#emit(session, activity);
      }
      if (
        (update.sessionUpdate === "agent_message_chunk" ||
          update.sessionUpdate === "agent_thought_chunk") &&
        update.content.type === "text"
      ) {
        const type =
          update.sessionUpdate === "agent_message_chunk" ? "answer" : "thought";
        session[type] += update.content.text;
        this.#emit(session, {
          type,
          sessionId: params.sessionId,
          text: update.content.text,
        });
      }
      await notify(message);
    };
    const work = session.project.agent.prompt(
      params,
      publish,
      (signal, budgets) =>
        prepareAcpTools(
          session.tools,
          params.sessionId,
          budgets,
          signal,
          publish,
          session.requestPermission,
        ),
    );
    session.active = work;
    try {
      return await work;
    } catch (error) {
      this.#emit(session, {
        type: "error",
        sessionId: params.sessionId,
        message:
          "The engine turn failed or was cancelled. See the client response for details.",
      });
      throw error;
    } finally {
      delete session.active;
      delete session.input;
      if (
        this.#sessions.has(params.sessionId) &&
        session.project.agent.openSessionIds().includes(params.sessionId)
      )
        this.#snapshot(params.sessionId, session);
    }
  }

  control(sessionId: string, control: SessionControl) {
    const session = this.#require(sessionId);
    const state = this.#state(sessionId, session, control);
    this.#emit(session, {
      type: "session/activity",
      sessionId,
      active: !!session.active,
      state,
    });
    if (control.action === "close") {
      // Let the current control reply flush before closing borrowed panel sockets.
      setImmediate(() => {
        if (this.#sessions.has(sessionId))
          void this.closeSession(sessionId).catch(() => undefined);
      });
    } else if (control.action === "model") {
      void session
        .notify?.({
          sessionId,
          update: {
            sessionUpdate: "config_option_update",
            configOptions:
              session.project.agent.sessionConfigOptions(sessionId),
          },
        })
        .catch(() => undefined);
    }
    return state;
  }

  async closeSession(sessionId: string) {
    const session = this.#require(sessionId);
    for (const [generationId, controller] of session.generations) {
      controller.abort();
      session.project.agent.resolveGeneratedImage(sessionId, generationId, {
        status: "cancelled",
        error: "Image generation cancelled because the session closed.",
      });
    }
    session.generations.clear();
    session.project.agent.cancel({ sessionId });
    await session.active?.catch(() => undefined);
    if (session.project.agent.openSessionIds().includes(sessionId))
      session.project.agent.closeSession({ sessionId });
    this.#sessions.delete(sessionId);
    await session
      .notify?.({
        sessionId,
        update: {
          sessionUpdate: "session_info_update",
          _meta: { "engine.closed": true },
        },
      })
      .catch(() => undefined);
    session.listeners.clear();
    await session.tools.close();
    await session.panel?.close();
    return {};
  }

  setConfigOption(
    params: import("@agentclientprotocol/sdk").SetSessionConfigOptionRequest,
  ) {
    const session = this.#require(params.sessionId);
    const result = session.project.agent.setSessionConfigOption(params);
    this.#snapshot(params.sessionId, session);
    return result;
  }

  async close() {
    this.#closed = true;
    await Promise.allSettled([...this.#initializing]);
    await Promise.allSettled(
      [...this.#sessions.keys()].map((id) => this.closeSession(id)),
    );
    if (this.#ownsRegistry) this.#registry.close();
    this.#projects.clear();
  }

  async #completeGeneratedImage(
    sessionId: string,
    generationId: string,
    prompt: string,
    controller: AbortController,
  ): Promise<void> {
    const session = this.#sessions.get(sessionId);
    if (session === undefined) return;
    try {
      const generated = await this.#generateImageProvider(
        session.project,
        prompt,
        controller.signal,
      );
      if (controller.signal.aborted) {
        session.project.agent.resolveGeneratedImage(sessionId, generationId, {
          status: "cancelled",
          error: "Image generation cancelled.",
        });
      } else {
        session.project.agent.resolveGeneratedImage(sessionId, generationId, {
          status: "completed",
          locator: generated.locator,
          mediaType: generated.mediaType,
          filename: generated.filename,
        });
      }
    } catch {
      if (this.#sessions.get(sessionId) !== session) return;
      session.project.agent.resolveGeneratedImage(sessionId, generationId, {
        status: controller.signal.aborted ? "cancelled" : "failed",
        error: controller.signal.aborted
          ? "Image generation cancelled."
          : "Image generation failed.",
      });
    } finally {
      if (this.#sessions.get(sessionId) === session) {
        session.generations.delete(generationId);
        this.#snapshot(sessionId, session);
      }
    }
  }

  async #generateImageProvider(
    project: ProjectRuntime,
    prompt: string,
    signal: AbortSignal,
  ): Promise<GeneratedImage> {
    signal.throwIfAborted();
    if (this.#options.generateImage !== undefined) {
      return await this.#options.generateImage({ project, prompt, signal });
    }
    const secretsPath = defaultSecretsPath(this.#options.env);
    const generated = await handleImageGenerate({
      apiKey: resolveNvidiaApiKey(this.#options.env, secretsPath),
      kieApiKey: resolveKieApiKey(this.#options.env, secretsPath),
      fetch: globalThis.fetch.bind(globalThis),
      catalogPath: defaultCatalogPath(this.#options.env),
      storeRoot: project.runtime.sourceStoreRoot,
      body: { prompt },
    });
    signal.throwIfAborted();
    return generated;
  }

  #state(
    sessionId: string,
    session: EngineSession,
    control: SessionControl = { action: "inspect" },
  ): SessionSnapshot {
    return this.#withWorkspaceCwd(
      session,
      session.project.agent.controlSession({ sessionId, ...control }),
    );
  }

  #withWorkspaceCwd(
    session: EngineSession,
    state: SessionSnapshot,
  ): SessionSnapshot {
    return { ...state, runtime: { ...state.runtime, cwd: session.cwd } };
  }
  #require(id: string) {
    const session = this.#sessions.get(id);
    if (!session) throw new Error("Unknown engine session.");
    return session;
  }
  #emit(session: EngineSession, message: GuiHostServerMessage) {
    for (const listener of session.listeners) listener(message);
  }
  #snapshot(sessionId: string, session: EngineSession) {
    const state = this.#state(sessionId, session);
    this.#emit(session, {
      type: "session/activity",
      sessionId,
      active: !!session.active,
      state,
    });
  }

  #panelBridge(sessionId: string, session: EngineSession): AcpBridge {
    const agent = session.project.agent;
    return {
      newSession: async () => {
        this.#require(sessionId);
        return { sessionId };
      },
      controlSession: async (id, control) => {
        if (id !== sessionId) throw new Error("Wrong panel session.");
        return this.control(id, control);
      },
      generateImage: async (id, prompt) => {
        if (id !== sessionId) throw new Error("Wrong panel session.");
        return this.generateImage(id, prompt);
      },
      prompt: async (id, text, _handlers, signal) => {
        if (id !== sessionId) throw new Error("Wrong panel session.");
        signal.throwIfAborted();
        const abort = () => agent.cancel({ sessionId });
        signal.addEventListener("abort", abort, { once: true });
        try {
          await this.prompt(
            { sessionId, prompt: [{ type: "text", text }] },
            session.notify ?? (async () => undefined),
          );
        } finally {
          signal.removeEventListener("abort", abort);
        }
      },
      cancel: (id) => {
        if (id === sessionId) agent.cancel({ sessionId });
      },
      // Panel sockets borrow the client's session. Only an explicit Close ends it.
      closeSession: async () => undefined,
      close: async () => undefined,
      inspectMemory: async (query) =>
        session.project.runtime.inspectMemory(query),
      ingestSource: async (input) => agent.ingestSource(input),
      subscribeSession: (id, listener) => {
        if (id !== sessionId) throw new Error("Wrong panel session.");
        return this.subscribeSession(id, listener);
      },
    };
  }
}
