import { useEffect, useState } from "react";
import type { McpServer } from "../../../packages/protocol/src/index.js";
import { loadMcpServers, saveMcpServers } from "./mcp-servers.js";

type DraftServer = McpServer;

const blank = (): DraftServer => ({
  name: "",
  command: "",
  args: [],
  env: [],
  enabled: true,
});

function draftValid(server: DraftServer): boolean {
  const names = new Set<string>();
  return (
    Boolean(server.name.trim()) &&
    Boolean(server.command.trim()) &&
    server.args.every((arg) => typeof arg === "string") &&
    server.env.every((entry) => {
      const name = entry.name.trim();
      if (!name || names.has(name)) return false;
      names.add(name);
      return true;
    })
  );
}

export function McpServersPanel() {
  const [servers, setServers] = useState<readonly DraftServer[]>([]);
  const [draft, setDraft] = useState<DraftServer>(blank);
  const [editing, setEditing] = useState<number>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void loadMcpServers(controller.signal)
      .then((catalog) => setServers(catalog.servers))
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : "MCP settings failed.",
          );
      });
    return () => controller.abort();
  }, []);

  const update = (next: Partial<DraftServer>) => {
    setDraft((current) => ({ ...current, ...next }));
    setError("");
    setNotice("");
  };
  const edit = (index: number) => {
    const server = servers[index]!;
    setDraft({
      ...server,
      args: [...server.args],
      env: server.env.map((entry) => ({ ...entry })),
    });
    setEditing(index);
    setError("");
    setNotice("");
  };
  const save = () => {
    if (!draftValid(draft)) {
      setError(
        "Name, command and unique non-empty environment names are required.",
      );
      return;
    }
    const next = [...servers];
    if (editing === undefined) next.push(draft);
    else next[editing] = draft;
    setBusy(true);
    setError("");
    setNotice("");
    void saveMcpServers(next)
      .then((catalog) => {
        setServers(catalog.servers);
        setDraft(blank());
        setEditing(undefined);
        setNotice(
          "Saved. Start a new session to use the updated MCP tool catalog.",
        );
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Save failed."),
      )
      .finally(() => setBusy(false));
  };
  const remove = (index: number) => {
    setBusy(true);
    setError("");
    void saveMcpServers(servers.filter((_, current) => current !== index))
      .then((catalog) => {
        setServers(catalog.servers);
        if (editing === index) {
          setEditing(undefined);
          setDraft(blank());
        }
        setNotice(
          "Saved. Existing sessions retain their current tool catalog.",
        );
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Remove failed."),
      )
      .finally(() => setBusy(false));
  };
  const toggle = (index: number) => {
    const next = servers.map((server, current) =>
      current === index ? { ...server, enabled: !server.enabled } : server,
    );
    setBusy(true);
    void saveMcpServers(next)
      .then((catalog) => {
        setServers(catalog.servers);
        setNotice(
          "Saved. Existing sessions retain their current tool catalog.",
        );
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Save failed."),
      )
      .finally(() => setBusy(false));
  };

  return (
    <section className="a008-mcp" aria-label="MCP servers">
      <h3>MCP servers</h3>
      <p>
        Configure approved local stdio servers. A008 starts them only through
        the shared tool session, and each MCP tool call still needs approval.
        Changes apply when a new session is constructed; they do not alter an
        active session.
      </p>
      <ul>
        {servers.map((server, index) => (
          <li key={`${server.name}/${index}`}>
            <div>
              <strong>{server.name}</strong>
              <code>{server.command}</code>
              <span>{server.enabled ? "Enabled" : "Disabled"}</span>
            </div>
            <div>
              <button type="button" disabled={busy} onClick={() => edit(index)}>
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggle(index)}
              >
                {server.enabled ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(index)}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="a008-mcp-editor">
        <h4>{editing === undefined ? "Add MCP server" : "Edit MCP server"}</h4>
        <label>
          Name
          <input
            value={draft.name}
            onChange={(event) => update({ name: event.target.value })}
          />
        </label>
        <label>
          Command
          <input
            value={draft.command}
            onChange={(event) => update({ command: event.target.value })}
          />
        </label>
        <label>
          Arguments (one per line)
          <textarea
            rows={3}
            value={draft.args.join("\n")}
            onChange={(event) =>
              update({
                args:
                  event.target.value === ""
                    ? []
                    : event.target.value.split("\n"),
              })
            }
          />
        </label>
        <label>
          Environment (non-secret `NAME=value`, one per line)
          <textarea
            rows={3}
            value={draft.env
              .map((entry) => `${entry.name}=${entry.value}`)
              .join("\n")}
            onChange={(event) =>
              update({
                env:
                  event.target.value === ""
                    ? []
                    : event.target.value.split("\n").map((line) => {
                        const index = line.indexOf("=");
                        return index < 1
                          ? { name: line, value: "" }
                          : {
                              name: line.slice(0, index),
                              value: line.slice(index + 1),
                            };
                      }),
              })
            }
          />
        </label>
        <label className="a008-parameter-toggle">
          <span>Enabled</span>
          <input
            type="checkbox"
            role="switch"
            checked={draft.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
          />
        </label>
        <div className="a008-parameter-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDraft(blank());
              setEditing(undefined);
            }}
          >
            Clear
          </button>
          <button
            type="button"
            className="a008-parameter-apply"
            disabled={busy}
            onClick={save}
          >
            {busy ? "Saving…" : "Save MCP server"}
          </button>
        </div>
      </div>
      {error ? (
        <p className="a008-parameter-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="a008-parameter-success" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
