import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { HttpClientOptions } from "../../../packages/client/src/index.js";
import { createPlatformHttp } from "./platform-client.js";
import {
  createPlatformSurface,
  type PlatformSnapshot,
} from "./platform-surface.js";
import "./platform.css";

export function PlatformPage(props: {
  readonly active: boolean;
  readonly model: string;
  readonly http?: HttpClientOptions;
  readonly createCommandId?: () => string;
  readonly pollIntervalMs?: number;
}) {
  const surfaceRef = useRef<ReturnType<typeof createPlatformSurface> | undefined>(
    undefined,
  );
  if (surfaceRef.current === undefined) {
    surfaceRef.current = createPlatformSurface({
      http: props.http ?? createPlatformHttp(),
      model: props.model,
      ...(props.createCommandId === undefined
        ? {}
        : { createCommandId: props.createCommandId }),
      ...(props.pollIntervalMs === undefined
        ? {}
        : { pollIntervalMs: props.pollIntervalMs }),
    });
  }
  const surface = surfaceRef.current;
  const snapshot = useSyncExternalStore(
    surface.subscribe,
    surface.getSnapshot,
    surface.getSnapshot,
  );
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  useEffect(() => {
    surface.setModel(props.model);
  }, [surface, props.model]);
  useEffect(() => {
    if (!props.active) {
      surface.deactivate();
      return;
    }
    void surface.activate();
    return () => surface.deactivate();
  }, [props.active, surface]);
  return (
    <PlatformPageView
      snapshot={snapshot}
      draft={draft}
      title={title}
      onDraft={setDraft}
      onTitle={setTitle}
      onSelectProject={(projectId) => {
        void surface.selectProject(projectId);
      }}
      onSelectConversation={(conversationId) => {
        void surface.selectConversation(conversationId);
      }}
      onCreateConversation={() => {
        void surface.createConversation(title).then((created) => {
          if (created) setTitle("");
        });
      }}
      onStart={() => {
        void surface.startRun(draft);
      }}
      onRetry={() => {
        void surface.retry();
      }}
    />
  );
}

export function PlatformPageView(props: {
  readonly snapshot: PlatformSnapshot;
  readonly draft: string;
  readonly title: string;
  readonly onDraft: (value: string) => void;
  readonly onTitle: (value: string) => void;
  readonly onSelectProject: (projectId: string) => void;
  readonly onSelectConversation: (conversationId: string) => void;
  readonly onCreateConversation: () => void;
  readonly onStart: () => void;
  readonly onRetry: () => void;
}) {
  const snapshot = props.snapshot;
  return (
    <section className="a008-platform" aria-label="Platform">
      <header>
        <p>PLATFORM V3</p>
        <h1>Platform</h1>
      </header>
      {snapshot.phase === "unavailable" ? (
        <p className="a008-platform-unavailable">
          Platform V3 is unavailable. No run was started.
        </p>
      ) : null}
      {snapshot.phase === "login-required" ? (
        <p className="a008-platform-login">
          Platform resources require the existing host login.
        </p>
      ) : null}
      {snapshot.phase === "loading" || snapshot.phase === "error" || snapshot.phase === "idle" ? (
        <p>{snapshot.message || "Platform is idle."}</p>
      ) : null}
      {snapshot.phase === "ready" ? (
        <div className="a008-platform-grid">
          <label>
            Project
            <select
              aria-label="Platform project"
              value={snapshot.projectId}
              onChange={(event) => props.onSelectProject(event.target.value)}
            >
              <option value="">Select a project</option>
              {snapshot.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          {snapshot.projects.length === 0 ? (
            <p>No projects known to the GUI.</p>
          ) : null}
          <div className="a008-platform-create">
            <label>
              Conversation title
              <input
                aria-label="Conversation title"
                value={props.title}
                onChange={(event) => props.onTitle(event.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={snapshot.projectId === "" || props.title.trim() === ""}
              onClick={props.onCreateConversation}
            >
              Create conversation
            </button>
          </div>
          <ul className="a008-platform-conversations" aria-label="Platform conversations">
            {snapshot.conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  aria-current={
                    conversation.id === snapshot.conversationId ? "true" : undefined
                  }
                  onClick={() => props.onSelectConversation(conversation.id)}
                >
                  {conversation.title}
                </button>
              </li>
            ))}
          </ul>
          <ol className="a008-platform-messages" aria-label="Platform messages">
            {snapshot.messages.map((message, index) => (
              <li key={`${message.role}-${String(index)}`}>
                <span>{message.role}</span>
                {message.text}
              </li>
            ))}
          </ol>
          <p className="a008-platform-model">
            {snapshot.model.trim() === ""
              ? "No model selected."
              : `Model: ${snapshot.model}`}
          </p>
          <label>
            Text run
            <textarea
              aria-label="Platform prompt"
              value={props.draft}
              onChange={(event) => props.onDraft(event.target.value)}
            />
          </label>
          <div className="a008-platform-actions">
            <button
              type="button"
              disabled={!snapshot.canStart || props.draft.trim() === ""}
              onClick={props.onStart}
            >
              Start text run
            </button>
            {snapshot.canRetry ? (
              <button type="button" onClick={props.onRetry}>
                Retry
              </button>
            ) : null}
          </div>
          {snapshot.commandId !== "" ? <p>Command id: {snapshot.commandId}</p> : null}
          {snapshot.runStatus !== "" ? (
            <p className="a008-platform-run-status" aria-live="polite">
              Run status: {snapshot.runStatus}
            </p>
          ) : null}
          {snapshot.attempt?.state === "conflict" ? (
            <p className="a008-platform-conflict">
              Command conflict. The command id was not replaced.
            </p>
          ) : null}
          {snapshot.message !== "" ? <p>{snapshot.message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
