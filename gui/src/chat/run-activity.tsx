import { useEffect, useMemo, useState } from "react";
import type { GuiSession, RuntimeToolCall } from "../session/types.js";

const RECOVERABLE = new Set([
  "stale_base",
  "no_exact_match",
  "ambiguous_match",
  "count_mismatch",
]);
const REAL_FAILURE = new Set([
  "spawn_failed",
  "protocol_error",
  "invalid_arguments",
  "timeout",
  "cancelled",
  "process_lost",
  "denied",
]);

function duration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  return hours > 0
    ? `${hours}h ${minutes}m ${seconds}s`
    : minutes > 0
      ? `${minutes}m ${seconds}s`
      : `${seconds}s`;
}

function isRunning(tool: RuntimeToolCall): boolean {
  return tool.status === "running" || tool.status === "pending" || tool.status === "in_progress";
}

export function runHealth(session: GuiSession, now = Date.now()) {
  const run = session.run;
  const runningTool = [...(session.tools ?? [])].reverse().find(isRunning);
  const toolTimeout = session.details?.runtimePreferences?.settings.budgets.toolTimeoutMs ?? 60_000;
  const providerTimeout = session.details?.runtimePreferences?.settings.budgets.providerTimeoutMs ?? 180_000;
  const threshold = (runningTool ? toolTimeout : providerTimeout) + 5_000;
  const quietFor = run ? Math.max(0, now - run.lastProgressAt) : 0;
  const stalled = Boolean(session.busy && run && quietFor > threshold);

  const state = stalled
    ? "STALLED"
    : session.process?.state === "stopped" && session.busy
      ? "PROCESS_DEAD"
      : session.permission
        ? "WAITING_APPROVAL"
        : runningTool
          ? "RUNNING_TOOL"
          : session.busy
            ? session.answer
              ? "FINISHING"
              : "WAITING_PROVIDER"
            : run?.status?.toUpperCase() ?? "IDLE";
  return { state, runningTool, quietFor, stalled };
}

function toolStats(tools: readonly RuntimeToolCall[]) {
  let success = 0;
  let nonzero = 0;
  let recoverable = 0;
  let failures = 0;
  let running = 0;
  for (const tool of tools) {
    if (isRunning(tool)) {
      running += 1;
      continue;
    }
    if (tool.outcome === "command_nonzero") nonzero += 1;
    else if (tool.outcome && RECOVERABLE.has(tool.outcome)) recoverable += 1;
    else if (
      (tool.outcome && REAL_FAILURE.has(tool.outcome)) ||
      tool.status === "failed"
    )
      failures += 1;
    else success += 1;
  }
  return { success, nonzero, recoverable, failures, running };
}

export function RunActivityTimeline({ session }: { readonly session: GuiSession }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!session.busy) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [session.busy]);

  const tools = session.tools ?? [];
  const stats = useMemo(() => toolStats(tools), [tools]);
  const modelVisibleBytes = useMemo(
    () => tools.reduce((total, tool) => total + (tool.modelVisibleBytes ?? 0), 0),
    [tools],
  );
  const hasModelBytes = tools.some((tool) => tool.modelVisibleBytes !== undefined);
  const health = runHealth(session, now);
  const run = session.run;
  if (!run && !session.busy && tools.length === 0) return null;

  const recent = tools.slice(-4);
  return (
    <section
      className={`a008-run-activity${health.stalled ? " is-stalled" : ""}`}
      aria-label="Run activity"
    >
      <div className="a008-run-activity-primary">
        <strong>{health.state}</strong>
        <span>{run ? duration(now - run.createdAt) : "starting"}</span>
        <span>last progress {run ? duration(health.quietFor) + " ago" : "—"}</span>
      </div>
      <div className="a008-run-activity-stats">
        <span>{tools.length} calls</span>
        <span className="is-ok">✓ {stats.success}</span>
        <span className="is-warning">⚠ {stats.nonzero}</span>
        <span className="is-recoverable">↻ {stats.recoverable}</span>
        <span className="is-failed">✕ {stats.failures}</span>
        {stats.running ? <span>● {stats.running} running</span> : null}
        <span>
          model bytes {hasModelBytes ? modelVisibleBytes.toLocaleString() : "—"}
        </span>
        <span title="Exact serialized provider request bytes are owned by the provider/continuation path and are not projected here yet.">
          request bytes —
        </span>
      </div>
      {recent.length ? (
        <div className="a008-run-activity-events" aria-label="Recent run events">
          {recent.map((tool) => (
            <span
              key={tool.id}
              className={
                tool.outcome === "command_nonzero"
                  ? "is-warning"
                  : tool.outcome && RECOVERABLE.has(tool.outcome)
                    ? "is-recoverable"
                    : tool.status === "failed"
                      ? "is-failed"
                      : isRunning(tool)
                        ? "is-running"
                        : "is-ok"
              }
              title={tool.text}
            >
              {tool.title ?? tool.tool ?? "tool"} · {tool.outcome ?? tool.status}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
