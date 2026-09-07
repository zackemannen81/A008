import { useEffect, useMemo, useState } from "react";
import type { GuiSession } from "../session/types.js";
import {
  loadWorkspaceFiles,
  type WorkspaceFile,
} from "../workbench/workspace-status.js";
import "./files.css";

export function FilesPane(props: {
  readonly session: GuiSession;
  readonly onOpen: (path: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<readonly WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const ready = props.session.status === "ready";

  useEffect(() => {
    if (!ready) {
      setFiles([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void loadWorkspaceFiles()
      .then((list) => {
        if (!controller.signal.aborted) setFiles(list);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [ready, props.session.details?.runtime.cwd]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? files.filter((file) => file.path.toLowerCase().includes(needle))
      : files;
    return filtered.slice(0, 200);
  }, [files, query]);

  return (
    <section className="a008-files" aria-label="Files">
      <header>
        <h2>Files</h2>
        <p>Tracked Git files in the workspace. Opening one asks the model to read it.</p>
      </header>
      <label>
        <span className="a008-sr-only">Filter files</span>
        <input
          type="search"
          value={query}
          placeholder="Filter by path…"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {loading ? <p className="a008-files-status">Reading git ls-files…</p> : null}
      {!ready ? (
        <p className="a008-files-status">Connect to list tracked files.</p>
      ) : !loading && files.length === 0 ? (
        <p className="a008-files-status">
          No tracked files. The workspace may not be a Git repository.
        </p>
      ) : (
        <ul>
          {visible.map((file) => (
            <li key={file.path}>
              <button type="button" onClick={() => props.onOpen(file.path)}>
                {file.path}
              </button>
            </li>
          ))}
        </ul>
      )}
      {files.length > 200 ? (
        <p className="a008-files-status">Showing 200 of {files.length} files. Filter to narrow.</p>
      ) : null}
    </section>
  );
}
