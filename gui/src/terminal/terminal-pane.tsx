import { useState, type FormEvent } from "react";
import {
  runShellCommand,
  ShellCommandError,
} from "./run-shell-command.js";

export {
  executeShellCommand,
  formatShellHostResult,
  runShellCommand,
  SHELL_ENDPOINT,
  ShellCommandError,
} from "./run-shell-command.js";
export type {
  RunShellCommandOptions,
  ShellHostResult,
} from "./run-shell-command.js";

interface HistoryEntry {
  readonly command: string;
  readonly output: string;
  readonly failed: boolean;
}

function errorMessage(error: unknown): string {
  if (error instanceof ShellCommandError || error instanceof Error) {
    return error.message;
  }
  return "Shell command failed.";
}

export function TerminalPane() {
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<readonly HistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const command = draft.trim();
    if (command.length === 0 || busy) {
      return;
    }
    setBusy(true);
    try {
      const output = await runShellCommand(command);
      setHistory((entries) => [...entries, { command, output, failed: false }]);
      setDraft("");
    } catch (error) {
      setHistory((entries) => [
        ...entries,
        { command, output: errorMessage(error), failed: true },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="a008-terminal" aria-label="Terminal" aria-busy={busy}>
      <h2>Terminal</h2>
      <p>
        Commands run on the A008 host through POST /v1/shell. They are not
        executed in the browser.
      </p>
      {history.length === 0 ? (
        <p className="a008-terminal-empty">No commands yet.</p>
      ) : (
        <ol className="a008-terminal-history">
          {history.map((entry, index) => (
            <li
              key={`${index}:${entry.command}`}
              data-failed={entry.failed ? "true" : "false"}
            >
              <div className="a008-terminal-command">{`$ ${entry.command}`}</div>
              <pre className="a008-terminal-output">{entry.output}</pre>
            </li>
          ))}
        </ol>
      )}
      <form className="a008-terminal-form" onSubmit={onSubmit}>
        <label>
          Command
          <input
            name="command"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            aria-busy={busy}
          />
        </label>
        <button type="submit" disabled={busy || draft.trim().length === 0}>
          Run
        </button>
      </form>
    </section>
  );
}
