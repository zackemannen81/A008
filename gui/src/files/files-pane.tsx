import { useEffect, useState } from "react";
import { HighlightedEditor } from "../highlight/highlighted-editor.js";
import type { GuiSession } from "../session/types.js";
import { guiHttp } from "../client.js";
import "./files.css";

type Entry = { readonly name: string; readonly path: string; readonly type: "directory" | "file" };
type OpenFile = { readonly path: string; readonly content: string; readonly sha256: string };

function languageFor(path: string): string | undefined {
  const name = path.split("/").at(-1) ?? "";
  if (name === "Dockerfile") return "dockerfile";
  return name.includes(".") ? name.split(".").at(-1) : undefined;
}

async function request<T>(path: string, init?: { readonly method?: string; readonly headers?: Record<string, string>; readonly body?: string; readonly signal?: AbortSignal }): Promise<T> {
  const response = await guiHttp().fetch(path, init);
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "File request failed.");
  return body;
}

export function FilesPane(props: { readonly session: GuiSession; readonly onOpen: (path: string) => void }) {
  const [directory, setDirectory] = useState(".");
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [file, setFile] = useState<OpenFile>();
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const ready = props.session.status === "ready";

  useEffect(() => {
    if (!ready) { setEntries([]); setFile(undefined); return; }
    const controller = new AbortController();
    setLoading(true); setError(undefined);
    void request<{ entries: readonly Entry[] }>(`/v1/files?path=${encodeURIComponent(directory)}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setEntries(result.entries); })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not list files."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [directory, ready, props.session.details?.runtime.cwd]);

  async function open(path: string) {
    setLoading(true); setError(undefined); setNotice(undefined);
    try { const next = await request<OpenFile>(`/v1/file?path=${encodeURIComponent(path)}`); setFile(next); setDraft(next.content); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not open file."); }
    finally { setLoading(false); }
  }
  async function save() {
    if (!file || draft === file.content) return;
    setLoading(true); setError(undefined); setNotice(undefined);
    try {
      const saved = await request<OpenFile>("/v1/file", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: file.path, expectedSha256: file.sha256, content: draft }) });
      setFile(saved); setDraft(saved.content); setNotice("Saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save file."); }
    finally { setLoading(false); }
  }
  const parent = directory === "." ? undefined : directory.split("/").slice(0, -1).join("/") || ".";
  return <section className="a008-files" aria-label="Files">
    <header><h2>Files</h2><p>Local workspace files. Text edits require an unchanged SHA-256 revision.</p></header>
    {!ready ? <p className="a008-files-status">Connect to browse the active workspace.</p> : null}
    {ready ? <div className="a008-files-layout">
      <div className="a008-files-browser">
        <p className="a008-files-path">{directory}</p>
        {parent ? <button type="button" onClick={() => setDirectory(parent)}>..</button> : null}
        {entries.map((entry) => <button key={entry.path} type="button" onClick={() => entry.type === "directory" ? setDirectory(entry.path) : void open(entry.path)}>{entry.type === "directory" ? "▸ " : ""}{entry.name}</button>)}
      </div>
      <div className="a008-files-editor">
        {file ? <><div className="a008-files-editor-header"><code>{file.path}</code><button type="button" disabled={loading || draft === file.content} onClick={() => void save()}>Save</button></div><HighlightedEditor value={draft} language={languageFor(file.path)} aria-label={`Editing ${file.path}`} onChange={setDraft} /></> : <p className="a008-files-status">Choose a UTF-8 text file.</p>}
      </div>
    </div> : null}
    {loading ? <p className="a008-files-status">Loading…</p> : null}
    {notice ? <p className="a008-files-status">{notice}</p> : null}
    {error ? <p className="a008-files-error" role="alert">{error}</p> : null}
  </section>;
}