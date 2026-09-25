import {
  listProjects,
  loadV2Info,
  PlatformV3ClientError,
  type HttpClientOptions,
  type PlatformV3Client,
  type PlatformV3Conversation,
  type PlatformV3Run,
} from "../../../packages/client/src/index.js";
import { createPlatformResourceClient } from "./platform-client.js";
import {
  platformMessageText,
  platformResourceCredentials,
  platformRunStatusText,
} from "./platform-access.js";

export interface PlatformAttempt {
  readonly commandId: string;
  readonly text: string;
  readonly model: string;
  readonly expectedRevision: number;
  readonly state: "pending" | "conflict" | "failed";
  readonly message: string;
}

export interface PlatformSnapshot {
  readonly phase:
    | "idle"
    | "loading"
    | "unavailable"
    | "login-required"
    | "error"
    | "ready";
  readonly message: string;
  readonly projects: readonly { readonly id: string; readonly name: string }[];
  readonly projectId: string;
  readonly conversations: readonly { readonly id: string; readonly title: string }[];
  readonly conversationId: string;
  readonly messages: readonly { readonly role: string; readonly text: string }[];
  readonly runStatus: string;
  readonly runId: string;
  readonly commandId: string;
  readonly attempt: PlatformAttempt | undefined;
  readonly model: string;
  readonly canStart: boolean;
  readonly canRetry: boolean;
}

const UNAVAILABLE = "Platform V3 is unavailable. No run was started.";
const LOGIN_REQUIRED = "Platform resources require the existing host login.";

function failureMessage(error: unknown): string {
  if (error instanceof PlatformV3ClientError) return error.message;
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return "Platform request failed.";
}

function abortError(): Error {
  const error = new Error("The platform poll was aborted.");
  error.name = "AbortError";
  return error;
}

export function sleepPlatformPoll(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => resolve(), ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

function latestRunId(conversation: PlatformV3Conversation): string | undefined {
  for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
    const runId = conversation.messages[index]?.runId;
    if (runId !== undefined && runId.length > 0) return runId;
  }
  return undefined;
}

function emptySnapshot(model: string): PlatformSnapshot {
  return {
    phase: "idle",
    message: "",
    projects: [],
    projectId: "",
    conversations: [],
    conversationId: "",
    messages: [],
    runStatus: "",
    runId: "",
    commandId: "",
    attempt: undefined,
    model,
    canStart: false,
    canRetry: false,
  };
}

export function createPlatformSurface(options: {
  readonly http: HttpClientOptions;
  readonly model?: string;
  readonly createCommandId?: () => string;
  readonly pollIntervalMs?: number;
  readonly sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}): PlatformSurface {
  return new PlatformSurface(options);
}

class PlatformSurface {
  readonly #http: HttpClientOptions;
  readonly #createCommandId: () => string;
  readonly #sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  readonly #pollIntervalMs: number;
  readonly #listeners = new Set<() => void>();

  #model: string;
  #snapshot: PlatformSnapshot;
  #phase: PlatformSnapshot["phase"] = "idle";
  #message = "";
  #projects: PlatformSnapshot["projects"] = [];
  #projectId = "";
  #conversations: PlatformSnapshot["conversations"] = [];
  #conversationId = "";
  #messages: PlatformSnapshot["messages"] = [];
  #revision = 0;
  #runStatus = "";
  #runId = "";
  #commandId = "";
  #attempt: PlatformAttempt | undefined;
  #resources: PlatformV3Client | undefined;
  #active = false;
  #generation = 0;
  #watchAbort: AbortController | undefined;

  constructor(options: {
    readonly http: HttpClientOptions;
    readonly model?: string;
    readonly createCommandId?: () => string;
    readonly pollIntervalMs?: number;
    readonly sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  }) {
    this.#http = options.http;
    this.#model = options.model ?? "";
    this.#createCommandId =
      options.createCommandId ??
      (() => globalThis.crypto.randomUUID());
    this.#sleep = options.sleep ?? sleepPlatformPoll;
    this.#pollIntervalMs = options.pollIntervalMs ?? 1000;
    this.#snapshot = emptySnapshot(this.#model);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): PlatformSnapshot => this.#snapshot;

  setModel(model: string): void {
    if (this.#model === model) return;
    this.#model = model;
    this.#publish();
  }

  async activate(): Promise<void> {
    if (this.#active) return;
    this.#active = true;
    const generation = ++this.#generation;
    this.#resetSelection();
    this.#phase = "loading";
    this.#message = "Checking platform…";
    this.#resources = undefined;
    this.#publish();
    const signal = this.#armLoadSignal();
    try {
      const info = await createPlatformResourceClient(this.#http).info(signal);
      if (!this.#current(generation)) return;
      if (!info.available) {
        this.#phase = "unavailable";
        this.#message = UNAVAILABLE;
        this.#publish();
        return;
      }
      const discovery = await loadV2Info(this.#http);
      if (!this.#current(generation)) return;
      const credentials = platformResourceCredentials(
        discovery.authProfiles,
        this.#http.credentials,
      );
      if (credentials === undefined) {
        this.#phase = "login-required";
        this.#message = LOGIN_REQUIRED;
        this.#publish();
        return;
      }
      const http = { ...this.#http, credentials };
      this.#resources = createPlatformResourceClient(http);
      const projects = await listProjects(http);
      if (!this.#current(generation)) return;
      this.#projects = projects.projects.map((project) => ({
        id: project.projectId,
        name: project.name,
      }));
      this.#phase = "ready";
      this.#message = "";
      this.#publish();
    } catch (error) {
      if (!this.#current(generation)) return;
      this.#phase = "error";
      this.#message = failureMessage(error);
      this.#publish();
    }
  }

  /** Stops polling. Does not cancel an accepted run. */
  deactivate(): void {
    this.#active = false;
    this.#generation += 1;
    this.#watchAbort?.abort();
    this.#watchAbort = undefined;
    this.#publish();
  }

  async selectProject(projectId: string): Promise<void> {
    if (!this.#active || this.#phase !== "ready") return;
    if (!this.#projects.some((project) => project.id === projectId)) return;
    this.#projectId = projectId;
    this.#conversationId = "";
    this.#messages = [];
    this.#revision = 0;
    this.#runStatus = "";
    this.#runId = "";
    this.#commandId = "";
    this.#attempt = undefined;
    this.#message = "";
    this.#publish();
    try {
      await this.#reloadConversations();
    } catch (error) {
      if (!this.#active) return;
      this.#message = failureMessage(error);
      this.#publish();
      return;
    }
    this.#armWatch();
  }

  async selectConversation(conversationId: string): Promise<void> {
    if (!this.#active || this.#phase !== "ready" || this.#projectId === "") return;
    if (!this.#conversations.some((item) => item.id === conversationId)) return;
    try {
      const body = await this.#requireResources().getConversation(conversationId);
      if (!this.#active || this.#projectId === "") return;
      this.#applyConversation(body.conversation);
      const runId = latestRunId(body.conversation);
      if (runId !== undefined) {
        const run = await this.#requireResources().getRun(runId);
        if (!this.#active) return;
        this.#applyRun(run.run);
      } else {
        this.#runId = "";
        this.#runStatus = "";
        this.#commandId = "";
      }
      this.#attempt = undefined;
      this.#message = "";
      this.#publish();
    } catch (error) {
      if (!this.#active) return;
      this.#message = failureMessage(error);
      this.#publish();
    }
  }

  async createConversation(title: string): Promise<boolean> {
    const trimmed = title.trim();
    if (!this.#active || this.#phase !== "ready" || this.#projectId === "") return false;
    if (trimmed.length === 0) return false;
    try {
      const created = await this.#requireResources().createConversation(this.#projectId, {
        title: trimmed,
      });
      if (!this.#active) return false;
      this.#applyConversation(created.conversation);
      this.#runId = "";
      this.#runStatus = "";
      this.#commandId = "";
      this.#attempt = undefined;
      this.#message = "";
      await this.#reloadConversations();
      this.#publish();
      return true;
    } catch (error) {
      if (!this.#active) return false;
      this.#message = failureMessage(error);
      this.#publish();
      return false;
    }
  }

  async startRun(text: string): Promise<void> {
    const trimmed = text.trim();
    const model = this.#model.trim();
    if (!this.#canStart() || trimmed.length === 0 || model.length === 0) return;
    await this.#submit({
      commandId: this.#createCommandId(),
      text: trimmed,
      model,
      expectedRevision: this.#revision,
      state: "pending",
      message: "",
    });
  }

  async retry(): Promise<void> {
    const attempt = this.#attempt;
    if (attempt === undefined || attempt.state === "pending") return;
    if (!this.#active || this.#phase !== "ready" || this.#conversationId === "") return;
    await this.#submit({ ...attempt, state: "pending", message: "" });
  }

  async #submit(attempt: PlatformAttempt): Promise<void> {
    this.#attempt = { ...attempt, state: "pending", message: "" };
    this.#commandId = attempt.commandId;
    this.#message = "";
    this.#publish();
    try {
      const accepted = await this.#requireResources().createRun(this.#conversationId, {
        commandId: attempt.commandId,
        expectedRevision: attempt.expectedRevision,
        model: attempt.model,
        text: attempt.text,
      });
      if (!this.#active) return;
      this.#attempt = undefined;
      this.#applyRun(accepted.run);
      this.#message = "";
      this.#publish();
      try {
        await this.#refreshSelected();
      } catch {
        if (this.#active) this.#publish();
      }
    } catch (error) {
      if (!this.#active) return;
      if (error instanceof PlatformV3ClientError && error.code === "COMMAND_CONFLICT") {
        this.#attempt = { ...attempt, state: "conflict", message: "Command conflict" };
        this.#message = "Command conflict";
        this.#publish();
        return;
      }
      const message = failureMessage(error);
      this.#attempt = { ...attempt, state: "failed", message };
      this.#message = message;
      this.#publish();
    }
  }

  #canStart(): boolean {
    return (
      this.#active &&
      this.#phase === "ready" &&
      this.#conversationId !== "" &&
      this.#model.trim() !== "" &&
      this.#attempt === undefined
    );
  }

  async #reloadConversations(): Promise<void> {
    const listed = await this.#requireResources().listConversations(this.#projectId);
    if (!this.#active) return;
    this.#conversations = listed.conversations.map((item) => ({
      id: item.id,
      title: item.title,
    }));
    this.#publish();
  }

  async #refreshSelected(): Promise<void> {
    if (this.#conversationId === "") return;
    const body = await this.#requireResources().getConversation(this.#conversationId);
    if (!this.#active) return;
    this.#applyConversation(body.conversation);
    const runId = this.#runId !== "" ? this.#runId : latestRunId(body.conversation);
    if (runId === undefined) {
      this.#publish();
      return;
    }
    const run = await this.#requireResources().getRun(runId);
    if (!this.#active) return;
    this.#applyRun(run.run);
    this.#publish();
  }

  #applyConversation(conversation: PlatformV3Conversation): void {
    this.#conversationId = conversation.id;
    this.#revision = conversation.revision;
    this.#messages = conversation.messages.map((message) => ({
      role: message.role,
      text: platformMessageText(message.content),
    }));
    if (!this.#conversations.some((item) => item.id === conversation.id)) {
      this.#conversations = [
        ...this.#conversations,
        { id: conversation.id, title: conversation.title },
      ];
    }
  }

  #applyRun(run: PlatformV3Run): void {
    this.#runId = run.id;
    this.#runStatus = platformRunStatusText(run.status);
    this.#commandId = run.commandId;
    this.#revision = Math.max(this.#revision, run.revision);
  }

  #armLoadSignal(): AbortSignal {
    this.#watchAbort?.abort();
    const controller = new AbortController();
    this.#watchAbort = controller;
    return controller.signal;
  }

  #armWatch(): void {
    this.#watchAbort?.abort();
    if (!this.#active || this.#phase !== "ready" || this.#projectId === "") {
      this.#watchAbort = undefined;
      return;
    }
    const controller = new AbortController();
    this.#watchAbort = controller;
    void this.#watch(controller, this.#projectId);
  }

  async #watch(controller: AbortController, projectId: string): Promise<void> {
    let after: number | undefined;
    while (!controller.signal.aborted && this.#active && this.#projectId === projectId) {
      try {
        const page = await this.#requireResources().events(
          {
            projectId,
            limit: 100,
            ...(after === undefined ? {} : { after }),
          },
          controller.signal,
        );
        if (controller.signal.aborted || !this.#active || this.#projectId !== projectId) return;
        after = page.nextCursor;
        if (page.events.length > 0 && this.#conversationId !== "") {
          await this.#refreshSelected();
        }
        if (page.hasMore) continue;
        await this.#sleep(this.#pollIntervalMs, controller.signal);
      } catch {
        if (controller.signal.aborted || !this.#active) return;
        await this.#sleep(this.#pollIntervalMs, controller.signal).catch(() => undefined);
      }
    }
  }

  #requireResources(): PlatformV3Client {
    if (this.#resources === undefined) {
      throw new Error("Platform resources are not open.");
    }
    return this.#resources;
  }

  #current(generation: number): boolean {
    return this.#active && generation === this.#generation;
  }

  #resetSelection(): void {
    this.#projects = [];
    this.#projectId = "";
    this.#conversations = [];
    this.#conversationId = "";
    this.#messages = [];
    this.#revision = 0;
    this.#runStatus = "";
    this.#runId = "";
    this.#commandId = "";
    this.#attempt = undefined;
  }

  #publish(): void {
    const model = this.#model;
    const attempt = this.#attempt;
    this.#snapshot = {
      phase: this.#phase,
      message: this.#message,
      projects: this.#projects,
      projectId: this.#projectId,
      conversations: this.#conversations,
      conversationId: this.#conversationId,
      messages: this.#messages,
      runStatus: this.#runStatus,
      runId: this.#runId,
      commandId: this.#commandId,
      attempt,
      model,
      canStart: this.#canStart(),
      canRetry:
        this.#active &&
        this.#phase === "ready" &&
        (attempt?.state === "conflict" || attempt?.state === "failed"),
    };
    for (const listener of this.#listeners) listener();
  }
}

export type { PlatformSurface };
