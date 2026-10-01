import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadWorkspaceSessions,
  type HttpClientOptions,
} from "../../../packages/client/src/index.js";
import { requestJson } from "../../../packages/client/src/http.js";
import {
  guiConversationViewSchema,
  guiRunActivitySchema,
  type GuiConversationView,
  type GuiRunActivity,
  type WorkspaceSession,
} from "../../../packages/protocol/src/index.js";
import { guiHttp } from "../client.js";
import { ToolActivity } from "../tools/repository-pane.js";
import "./workers.css";

type Tab = "live" | "tools" | "runtime" | "process" | "task" | "console";
interface WorkerView {
  workspace: WorkspaceSession;
  view?: GuiConversationView;
  activity?: GuiRunActivity;
  lastProgressAt?: number;
}
function isActive(status: string | undefined) {
  return status === "queued" || status === "running" || status === "cancel_requested";
}
function runningTool(activity?: GuiRunActivity) {
  return [...(activity?.tools ?? [])].reverse().find((tool) =>
    ["running", "pending", "in_progress"].includes(tool.status),
  );
}
function fingerprint(runId: string, activity?: GuiRunActivity) {
  return JSON.stringify([
    runId,
    activity?.liveRevision,
    activity?.cursor,
    activity?.answer.length,
    activity?.tools.map((tool) => [tool.id, tool.status, tool.text.length, tool.outcome]),
    activity?.permission?.id,
  ]);
}
function elapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60
    ? `${minutes}m ${seconds % 60}s`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
function health(worker: WorkerView, now: number, toolTimeoutMs: number, providerTimeoutMs: number) {
  const run = worker.view?.runs.at(-1);
  const process = worker.view?.process;
  if (!run) return "IDLE";
  if (!isActive(run.status)) return run.status.toUpperCase();
  if (!process || process.state !== "running") return "PROCESS_DEAD";
  const tool = runningTool(worker.activity);
  const quiet = worker.lastProgressAt === undefined ? 0 : now - worker.lastProgressAt;
  const threshold = (tool ? toolTimeoutMs : providerTimeoutMs) + 5_000;
  if (worker.lastProgressAt !== undefined && quiet > threshold) return "STALLED";
  if (worker.activity?.permission) return "WAITING_APPROVAL";
  if (tool) return "RUNNING_TOOL";
  return "WAITING_PROVIDER";
}
async function loadWorker(
  http: HttpClientOptions,
  workspace: WorkspaceSession,
  model: string,
): Promise<{ view?: GuiConversationView; activity?: GuiRunActivity }> {
  if (!workspace.sessionId) return {};
  const { response, body } = await requestJson(
    http,
    `/v1/chat/v3/conversations/${encodeURIComponent(workspace.sessionId)}/view?model=${encodeURIComponent(model)}`,
  );
  if (response.status === 404) return {};
  if (!response.ok) throw new Error("Could not inspect worker conversation.");
  const view = guiConversationViewSchema.parse(body);
  const run = view.runs.at(-1);
  if (!run || !isActive(run.status)) return { view };
  const observed = await requestJson(
    http,
    `/v1/chat/v3/runs/${encodeURIComponent(run.id)}/activity`,
  );
  return {
    view,
    ...(observed.response.ok
      ? { activity: guiRunActivitySchema.parse(observed.body) }
      : {}),
  };
}
export function WorkersPage(props: {
  readonly active: boolean;
  readonly projectId?: string;
  readonly model: string;
  readonly toolTimeoutMs?: number;
  readonly providerTimeoutMs?: number;
  readonly onFollow: (conversationId: string) => Promise<void>;
}) {
  const [workers, setWorkers] = useState<readonly WorkerView[]>([]);
  const [selected, setSelected] = useState<string>();
  const [tab, setTab] = useState<Tab>("live");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const progress = useRef(new Map<string, { fingerprint: string; at: number }>());

  const refresh = useCallback(async () => {
    if (!props.projectId) {
      setWorkers([]);
      return;
    }
    const http = guiHttp();
    const listed = await loadWorkspaceSessions(http, props.projectId);
    const next = await Promise.all(
      listed.sessions
        .filter((workspace) => workspace.disposition === "active")
        .map(async (workspace): Promise<WorkerView> => {
          const observed = await loadWorker(http, workspace, props.model);
          const run = observed.view?.runs.at(-1);
          if (!run) return { workspace, ...observed };
          const key = fingerprint(run.id, observed.activity);
          const prior = progress.current.get(run.id);
          const at = prior?.fingerprint === key ? prior.at : Date.now();
          progress.current.set(run.id, { fingerprint: key, at });
          return { workspace, ...observed, lastProgressAt: at };
        }),
    );
    setWorkers(next);
    setSelected((current) =>
      current && next.some((worker) => worker.workspace.id === current)
        ? current
        : next[0]?.workspace.id,
    );
  }, [props.model, props.projectId]);

  useEffect(() => {
    if (!props.active) return;
    setError("");
    void refresh().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Worker inspection failed."),
    );
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void refresh().catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Worker inspection failed."),
      );
    }, 1_500);
    return () => window.clearInterval(timer);
  }, [props.active, refresh]);

  const toolTimeout = props.toolTimeoutMs ?? 60_000;
  const providerTimeout = props.providerTimeoutMs ?? 180_000;
  const worker = workers.find((entry) => entry.workspace.id === selected);
  return (
    <section className="a008-workers-page" aria-label="Workers">
      <header>
        <div><p className="a008-workers-kicker">MULTI-AGENT</p><h1>Workers</h1></div>
        <button type="button" onClick={() => void refresh()}>Refresh</button>
      </header>
      {!props.projectId ? <p>Select a project to inspect workers.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="a008-workers-layout">
        <aside className="a008-workers-list" aria-label="Worker overview">
          {workers.length === 0 ? <p>No active isolated workers.</p> : workers.map((entry) => {
            const run = entry.view?.runs.at(-1);
            const state = health(entry, now, toolTimeout, providerTimeout);
            const tool = runningTool(entry.activity);
            return (
              <button
                type="button"
                key={entry.workspace.id}
                className={entry.workspace.id === selected ? "is-selected" : ""}
                onClick={() => setSelected(entry.workspace.id)}
              >
                <strong>{entry.workspace.branchName ?? entry.workspace.id}</strong>
                <span className={state === "STALLED" || state === "PROCESS_DEAD" ? "is-bad" : ""}>{state}</span>
                <small>{run?.model ?? "no active run"} · {entry.view?.process?.processId ? `PID ${entry.view.process.processId}` : "no process"}</small>
                <small>{tool ? tool.title : run ? `run ${run.status}` : entry.workspace.workspaceMode}</small>
              </button>
            );
          })}
        </aside>
        <div className="a008-worker-inspector">
          {!worker ? <p>Select a worker.</p> : (
            <>
              <header className="a008-worker-head">
                <div>
                  <strong>{worker.workspace.branchName ?? worker.workspace.id}</strong>
                  <span>{health(worker, now, toolTimeout, providerTimeout)}</span>
                </div>
                {worker.workspace.sessionId ? (
                  <button type="button" onClick={() => void props.onFollow(worker.workspace.sessionId!)}>
                    Follow live
                  </button>
                ) : null}
              </header>
              <nav className="a008-worker-tabs" aria-label="Worker inspector">
                {(["live", "tools", "runtime", "process", "task", "console"] as const).map((id) => (
                  <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
                    {id[0]!.toUpperCase() + id.slice(1)}
                  </button>
                ))}
              </nav>
              <WorkerTab
                tab={tab}
                worker={worker}
                now={now}
                toolTimeoutMs={toolTimeout}
                providerTimeoutMs={providerTimeout}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function WorkerTab(props: {
  readonly tab: Tab;
  readonly worker: WorkerView;
  readonly now: number;
  readonly toolTimeoutMs: number;
  readonly providerTimeoutMs: number;
}) {
  const { worker } = props;
  const run = worker.view?.runs.at(-1);
  const process = worker.view?.process;
  const activity = worker.activity;
  const tool = runningTool(activity);
  if (props.tab === "tools") return <ToolActivity tools={activity?.tools} />;
  if (props.tab === "live")
    return (
      <div className="a008-worker-detail">
        <dl>
          <dt>State</dt><dd>{health(worker, props.now, props.toolTimeoutMs, props.providerTimeoutMs)}</dd>
          <dt>Current</dt><dd>{activity?.permission ? "approval" : tool?.title ?? (run && isActive(run.status) ? "provider" : "idle")}</dd>
          <dt>Run elapsed</dt><dd>{run ? elapsed(props.now - run.createdAt) : "—"}</dd>
          <dt>Last progress</dt><dd>{worker.lastProgressAt ? `${elapsed(props.now - worker.lastProgressAt)} ago` : "—"}</dd>
        </dl>
        {activity?.answer ? <pre>{activity.answer.slice(-2_000)}</pre> : <p>No public answer text yet.</p>}
      </div>
    );
  if (props.tab === "runtime")
    return <pre>{JSON.stringify({
      workerId: worker.workspace.id,
      runId: run?.id,
      model: run?.model,
      runStatus: run?.status,
      leaseGeneration: run?.leaseGeneration,
      activityCursor: activity?.cursor,
      liveRevision: activity?.liveRevision,
    }, null, 2)}</pre>;
  if (props.tab === "process")
    return <pre>{JSON.stringify({
      workerId: worker.workspace.id,
      sessionId: process?.sessionId ?? worker.workspace.sessionId,
      workspaceId: process?.workspaceId ?? worker.workspace.id,
      instanceId: process?.instanceId,
      processId: process?.processId,
      state: process?.state ?? "not running",
    }, null, 2)}</pre>;
  if (props.tab === "task")
    return (
      <div className="a008-worker-detail">
        <p><strong>Worktree</strong></p>
        <code>{worker.workspace.workspacePath}</code>
        <p><strong>Branch</strong> {worker.workspace.branchName ?? "shared"}</p>
        <p>CURRENT_TASK contents are not part of the existing worker observer protocol. Follow the worker to inspect files; no extra task-file API is created for this view.</p>
      </div>
    );
  return (
    <div className="a008-worker-detail">
      <p>Session worker stdio is intentionally detached today, so there is no PTY console to attach to.</p>
      <p><strong>Follow live</strong> attaches to the durable run/event stream instead. An interactive PTY can be added later only if a real workflow requires input ownership.</p>
    </div>
  );
}
