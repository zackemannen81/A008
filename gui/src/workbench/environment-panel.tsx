import { useEffect, useId, useState, type ChangeEvent } from "react";
import type { GuiSession } from "../session/types.js";
import { uploadSource, type UploadedSource } from "../upload/upload-source.js";
import {
  loadWorkspaceStatus,
  type WorkspaceStatus,
} from "./workspace-status.js";
import "./environment.css";

export const WORKBENCH_PROMPTS = {
  commit:
    "Check the working tree with git status and git diff. Stage and commit only when the changes are ready, then push if a configured upstream exists. Use the Git tool. Summarise what you did.",
  compare:
    "Compare the current branch with its upstream, or with main if no upstream is set. Use git status, git log and git diff. Summarise commits and unpushed work.",
} as const;

export interface SessionSource {
  readonly id: string;
  readonly name: string;
  readonly kind: "upload" | "clipboard";
  readonly locator?: string;
}

function formatCounts(status: WorkspaceStatus): string {
  return `+${status.added} −${status.removed}`;
}

export function EnvironmentPanel(props: {
  readonly session: GuiSession;
  readonly sources: readonly SessionSource[];
  readonly onSources: (sources: readonly SessionSource[]) => void;
  readonly onChat: () => void;
  readonly onShowAllSources: () => void;
}) {
  const fileId = useId();
  const [status, setStatus] = useState<WorkspaceStatus>();
  const [error, setError] = useState<string>();
  const [openLocal, setOpenLocal] = useState(false);
  const [openBranch, setOpenBranch] = useState(false);
  const cwd = props.session.details?.runtime.cwd;
  const workspace = cwd?.split(/[\\/]/u).filter(Boolean).at(-1);
  const ready = props.session.status === "ready" && !props.session.busy;

  useEffect(() => {
    if (props.session.status !== "ready") {
      return;
    }
    const controller = new AbortController();
    void loadWorkspaceStatus()
      .then((next) => {
        if (!controller.signal.aborted) setStatus(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus(undefined);
      });
    return () => controller.abort();
  }, [props.session.status, props.session.busy, cwd]);

  async function ask(prompt: string): Promise<void> {
    setError(undefined);
    props.onChat();
    try {
      await props.session.prompt(prompt);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not start that action.",
      );
    }
  }

  async function addFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    try {
      const uploaded: UploadedSource = await uploadSource(file);
      props.onSources([
        ...props.sources,
        {
          id: uploaded.locator,
          name: file.name,
          kind: "upload",
          locator: uploaded.locator,
        },
      ]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed.");
    }
  }

  async function addClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim().length === 0) {
        setError("Clipboard is empty.");
        return;
      }
      const file = new File([text], `clipboard-${Date.now()}.txt`, {
        type: "text/plain",
      });
      const uploaded = await uploadSource(file);
      props.onSources([
        ...props.sources,
        {
          id: uploaded.locator,
          name: file.name,
          kind: "clipboard",
          locator: uploaded.locator,
        },
      ]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Clipboard is not available in this browser.",
      );
    }
  }

  return (
    <section className="a008-environment" aria-label="Workbench">
      <div className="a008-environment-section">
        <header>
          <h2>Environment</h2>
        </header>
        <button
          type="button"
          className="a008-environment-row"
          disabled={!ready}
          onClick={() => void ask(
            "Granska ändringarna i arbetskopian med git status, git diff och git diff --cached. Läs berörda filer vid behov och sammanfatta fynden.",
          )}
        >
          <span aria-hidden="true">±</span>
          <span>Changes</span>
          <em>{status?.isRepo ? formatCounts(status) : "—"}</em>
        </button>
        <button
          type="button"
          className="a008-environment-row"
          aria-expanded={openLocal}
          onClick={() => setOpenLocal((value) => !value)}
        >
          <span aria-hidden="true">⌂</span>
          <span>Local</span>
          <em>{openLocal ? "▾" : "▸"}</em>
        </button>
        {openLocal ? (
          <p className="a008-environment-detail" title={cwd}>
            {cwd ?? "Connect to see the working directory."}
          </p>
        ) : null}
        <button
          type="button"
          className="a008-environment-row"
          aria-expanded={openBranch}
          onClick={() => setOpenBranch((value) => !value)}
        >
          <span aria-hidden="true">Y</span>
          <span>{status?.branch || workspace || "No branch"}</span>
          <em>{openBranch ? "▾" : "▸"}</em>
        </button>
        {openBranch ? (
          <p className="a008-environment-detail">
            {status?.upstream
              ? `Upstream ${status.upstream}${status.ahead ? ` · ahead ${status.ahead}` : ""}${status.behind ? ` · behind ${status.behind}` : ""}`
              : "No upstream configured."}
          </p>
        ) : null}
        <button
          type="button"
          className="a008-environment-row"
          disabled={!ready}
          onClick={() => void ask(WORKBENCH_PROMPTS.commit)}
        >
          <span aria-hidden="true">○</span>
          <span>Commit or push</span>
        </button>
        <p className="a008-environment-row a008-environment-static">
          <span aria-hidden="true">◌</span>
          <span>Pull request status is unavailable</span>
        </p>
        <button
          type="button"
          className="a008-environment-row"
          disabled={!ready}
          onClick={() => void ask(WORKBENCH_PROMPTS.compare)}
        >
          <span aria-hidden="true">↗</span>
          <span>Compare branch</span>
        </button>
      </div>
      <div className="a008-environment-section">
        <header>
          <h2>Sources</h2>
          <label className="a008-environment-add">
            <span className="a008-sr-only">Add a source file</span>
            <input
              id={fileId}
              type="file"
              onChange={(event) => void addFile(event)}
            />
            +
          </label>
        </header>
        {props.sources.length === 0 ? (
          <p className="a008-environment-empty">No attached sources yet.</p>
        ) : (
          props.sources.map((source) => (
            <p key={source.id} className="a008-environment-row a008-environment-static">
              <span aria-hidden="true">{source.kind === "clipboard" ? "⎘" : "▣"}</span>
              <span title={source.locator ?? source.name}>{source.name}</span>
            </p>
          ))
        )}
        <button type="button" className="a008-environment-row" onClick={addClipboard}>
          <span aria-hidden="true">⎘</span>
          <span>Add from clipboard</span>
        </button>
        <button
          type="button"
          className="a008-environment-row"
          onClick={props.onShowAllSources}
        >
          <span aria-hidden="true">↗</span>
          <span>Show all</span>
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
