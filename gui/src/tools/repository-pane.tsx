import { useState } from "react";
import type { GuiSession } from "../session/types.js";
import "./repository.css";

export const REPOSITORY_ACTIONS = [
  { label: "Read AGENTS.md & list root", tool: "read_file", prompt: "Läs AGENTS.md och lista filerna och mapparna i projektroten med dina verktyg. Redovisa vad du faktiskt hittar." },
  { label: "Git status", tool: "git", prompt: "Använd Git-verktyget för att visa aktuell gren och arbetskopians status. Sammanfatta resultatet." },
  { label: "Review changes", tool: "git", prompt: "Granska ändringarna i arbetskopian med git status, git diff och git diff --cached. Läs berörda filer vid behov och sammanfatta fynden." },
] as const;

export function ToolActivity({ session }: { session: GuiSession }) {
  if (!session.tools?.length) return null;
  return <section className="a008-tool-activity" aria-label="Tool activity">
    {session.tools.map(tool => <details key={tool.id}>
      <summary>{tool.title} · {tool.status}{tool.status === "pending" ? " — awaiting approval" : ""}</summary>
      <pre>{tool.text}</pre>
    </details>)}
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
    <ToolActivity session={session} />
  </section>;
}
