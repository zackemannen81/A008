import { useEffect, useState, type FormEvent } from "react";
import { loadWorkspaceSettings, saveWorkspaceSettings } from "./workspace-sessions.js";

export function WorkspaceSessionsPanel() {
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadWorkspaceSettings()
      .then((settings) => {
        setWorkspaceRoot(settings.workspaceRoot ?? "");
        setLoaded(true);
      })
      .catch((caught) => {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load parallel-session settings.",
          );
      });

  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const settings = await saveWorkspaceSettings(workspaceRoot.trim());
      setWorkspaceRoot(settings.workspaceRoot ?? "");
      setNotice("Parallel-session root saved.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save parallel-session settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="a008-parameter-form" aria-label="Parallel sessions">
      <h3>Parallel sessions</h3>
      <p>
        New isolated Git worktrees are created under this absolute local path.
        Create, open, keep, and discard remain in each project&apos;s details.
      </p>
      <form onSubmit={(event) => void save(event)}>
        <label>
          Worktree root
          <input
            aria-label="Worktree root"
            type="text"
            required
            disabled={!loaded || saving}
            value={workspaceRoot}
            onChange={(event) => setWorkspaceRoot(event.target.value)}
          />
        </label>
        <div className="a008-parameter-actions">
          <button type="submit" disabled={!loaded || saving}>
            {saving ? "Saving…" : "Save worktree root"}
          </button>
        </div>
      </form>
      {error ? <p className="a008-parameter-error" role="alert">{error}</p> : null}
      {notice ? <p className="a008-parameter-success" role="status">{notice}</p> : null}
    </section>
  );
}