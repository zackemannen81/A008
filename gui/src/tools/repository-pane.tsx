import { useEffect, useState } from "react";
import type { GuiSession, RuntimeToolCall } from "../session/types.js";
import "./repository.css";

export const REPOSITORY_ACTIONS = [
  { label: "Read AGENTS.md & list root", tool: "read_file", prompt: "Läs AGENTS.md och lista filerna och mapparna i projektroten med dina verktyg. Redovisa vad du faktiskt hittar." },
  { label: "Git status", tool: "git", prompt: "Använd Git-verktyget för att visa aktuell gren och arbetskopians status. Sammanfatta resultatet." },
  { label: "Review changes", tool: "git", prompt: "Granska ändringarna i arbetskopian med git status, git diff och git diff --cached. Läs berörda filer vid behov och sammanfatta fynden." },
] as const;

export type ToolDisplayStatus = "running" | "ok" | "recovered" | "failed" | "blocking";

export function displayStatus(tool: RuntimeToolCall): ToolDisplayStatus {
  if (tool.status === "running" || tool.status === "pending") return "running";
  if (tool.status === "ok" || tool.status === "completed") return "ok";
  if (tool.recoveredBy) return "recovered";
  return "failed";
}

function toolName(tool: RuntimeToolCall): string {
  return tool.tool || tool.title || "tool";
}

function rawStatus(tool: RuntimeToolCall): string {
  return tool.status === "completed" ? "completed" : tool.status === "pending" ? "pending" : displayStatus(tool);
}

function duration(tool: RuntimeToolCall): string {
  if (tool.finishedAt === undefined || tool.startedAt === undefined) return "";
  return `${Math.max(0, (tool.finishedAt - tool.startedAt) / 1000).toFixed(1)}s`;
}

function displayText(tool: RuntimeToolCall): string {
  return tool.argsSummary ?? tool.text ?? tool.errorSummary ?? "";
}

function isBlocking(tool: RuntimeToolCall): boolean {
  return displayStatus(tool) === "failed" && tool.recoveredBy === undefined;
}

export interface ToolSummaryDisclosure {
  readonly open: boolean;
  readonly active: boolean;
}

export function nextToolSummaryDisclosure(
  current: ToolSummaryDisclosure,
  hasTools: boolean,
  hasRunning: boolean,
): ToolSummaryDisclosure {
  if (!hasTools) return { open: false, active: false };
  if (!current.active) return { open: hasRunning, active: true };
  return current;
}

export function ToolActivity({
  tools,
}: {
  readonly tools?: readonly RuntimeToolCall[];
}) {
  const [disclosure, setDisclosure] = useState<ToolSummaryDisclosure>({
    open: false,
    active: false,
  });
  const hasTools = (tools?.length ?? 0) > 0;
  const hasRunning =
    tools?.some((tool) => displayStatus(tool) === "running") ?? false;

  useEffect(() => {
    setDisclosure((current) =>
      nextToolSummaryDisclosure(current, hasTools, hasRunning),
    );
  }, [hasTools, hasRunning]);

  if (!tools?.length) return null;
  const grouped = new Map<string, RuntimeToolCall[]>();
  for (const tool of tools) {
    const name = toolName(tool);
    const entries = grouped.get(name) ?? [];
    entries.push(tool);
    grouped.set(name, entries);
  }
  const counts = tools.reduce((result, tool) => {
    const status = displayStatus(tool);
    result[status] += 1;
    return result;
  }, { running: 0, ok: 0, recovered: 0, failed: 0, blocking: 0 });
  const completed = counts.running === 0;
  return <section className="a008-tool-activity" aria-label="Tool activity">
    <details
      className="a008-tool-summary"
      open={disclosure.open}
      onToggle={(event) => {
        const open = event.currentTarget.open;
        setDisclosure((current) => ({
          ...current,
          open,
        }));
      }}
    >
      <summary>{completed ? "✓" : "⚙"} Tools · {tools.length} calls · {completed ? "completed" : "running"}</summary>
      <div className="a008-tool-summary-counts">
        {counts.ok} ok · {counts.recovered} recovered · {counts.failed} failed · {counts.running} running
      </div>
      <div className="a008-tool-groups">
        {Array.from(grouped, ([name, entries]) => {
          const recovered = entries.filter(tool => displayStatus(tool) === "recovered").length;
          const failed = entries.filter(tool => isBlocking(tool)).length;
          return <details key={name}>
            <summary>{name} ×{entries.length} · ✓ {entries.length - recovered - failed} {recovered ? `· ↻ ${recovered}` : ""} {failed ? `· ✕ ${failed}` : ""}</summary>
            {entries.map(tool => <div key={tool.id} className={`a008-tool-row a008-tool-${displayStatus(tool)}`}>
              <span>{displayStatus(tool) === "recovered" ? "↻" : displayStatus(tool) === "ok" ? "✓" : displayStatus(tool) === "running" ? "⚙" : "✕"}</span>
              <span>{displayText(tool) || name}</span>
              <span>{rawStatus(tool)}{tool.status === "pending" ? " — awaiting approval" : ""}{duration(tool) ? ` · ${duration(tool)}` : ""}</span>
              <span className="a008-tool-legacy-label">{name} · {rawStatus(tool)}</span>
              {tool.errorSummary ? <small>{tool.errorSummary}</small> : null}
            </div>)}
          </details>;
        })}
      </div>
      <details className="a008-tool-raw"><summary>Raw trace</summary><pre>{JSON.stringify(tools, null, 2)}</pre></details>
    </details>
  </section>;
}

export function RepositoryPane({ session, onChat }: { session: GuiSession; onChat: () => void }) {
  const [error, setError] = useState<string>();
  const catalog = session.details?.runtime.tools;
  const ready = session.status === "ready" && !session.busy;
  async function ask(prompt: string) {
    setError(undefined);
    onChat();
    try { await session.prompt(prompt); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not start repository work."); }
  }
  return <section className="a008-repository" aria-label="Repository tools">
    <header><h2>Repository</h2><p>Work with your files from the chat.</p></header>
    <div className="a008-repository-root"><span>Working directory</span>
      <code>{session.details?.runtime.cwd ?? "Connect to see the active workspace."}</code>
    </div>
    {session.status !== "ready" && <button disabled={session.status === "connecting"} onClick={() => void session.connect()}>
      {session.status === "connecting" ? "Connecting…" : "Connect"}
    </button>}
    <div className="a008-repository-actions">
      {REPOSITORY_ACTIONS.map(action => <button key={action.tool + action.label}
        disabled={!ready || !catalog?.some(tool => tool.name === action.tool)} onClick={() => void ask(action.prompt)}>{action.label}</button>)}
    </div>
    {error && <p role="alert">{error}</p>}
    <h3>Model tools</h3>
    {catalog ? <dl className="a008-repository-catalog">{catalog.map(tool => <div key={tool.name}>
      <dt><code>{tool.name}</code>{tool.name === "git" && <span className="a008-repository-badge">Built in</span>}</dt>
      <dd>{tool.description}</dd>
    </div>)}</dl> : <p>{session.status === "ready" ? "Tool metadata is unavailable. Restart the updated A008 host and reconnect." : "Connect to load the host's tool catalog."}</p>}
    <p>Ask the model to read, create or edit files, run tests, or use Git. Each tool call shows its arguments for approval here. Git uses your host installation; no separate add-on is needed.</p>
    <p>Tool limits are editable in Parameters → Budgets. Your persistent instructions stay in Parameters → Instructions.</p>
    <ToolActivity tools={session.tools} />
  </section>;
}
