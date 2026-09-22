import { useEffect, useState } from "react";
import type {
  McpServer,
  McpServerHealth,
  McpServerHealthEntry,
} from "../../../packages/protocol/src/index.js";
import { loadMcpHealth, loadMcpServers, probeMcpServer, saveMcpServers } from "./mcp-servers.js";

type DraftServer = McpServer;

const blank = (): DraftServer => ({
  name: "",
  command: "",
  args: [],
  env: [],
  enabled: true,
});

const STATUS_LABEL = {
  ready: "READY",
  failed: "FAILED",
  restart_required: "RESTART REQUIRED",
  untested: "NOT TESTED",
} as const;

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

function testedClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Tested";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `Tested ${hours}:${minutes}`;
}

export function McpServerList(props: {
  servers: readonly DraftServer[];
  health?: McpServerHealth;
  busy: boolean;
  onEdit: (index: number) => void;
  onToggle: (index: number) => void;
  onRemove: (index: number) => void;
  onTest: (name: string) => void;
}) {
  return (
    <ul>
      {props.servers.map((server, index) => {
        const health = props.health?.servers.find(
          (entry) => entry.name === server.name,
        );
        return (
          <li key={`${server.name}/${index}`}>
            <McpServerStatus server={server} health={health} />
            <div className="a008-mcp-actions">
              <button
                type="button"
                disabled={props.busy}
                onClick={() => props.onEdit(index)}
              >
                Edit
              </button>
              <button
                type="button"
                disabled={props.busy}
                onClick={() => props.onTest(server.name)}
              >
                Reload & Test
              </button>
              <button
                type="button"
                disabled={props.busy}
                onClick={() => props.onToggle(index)}
              >
                {server.enabled ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                disabled={props.busy}
                onClick={() => props.onRemove(index)}
              >
                Remove
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function McpServerStatus(props: {
  server: DraftServer;
  health?: McpServerHealthEntry;
}) {
  const status = props.health?.status ?? "untested";
  return (
    <div>
      <div className="a008-mcp-heading">
        <strong>{props.server.name}</strong>
        <span className={`a008-mcp-status a008-mcp-status-${status}`}>
          {`● ${STATUS_LABEL[status]}`}
        </span>
      </div>
      <code>{[props.server.command, ...props.server.args].join(" ")}</code>
      <div className="a008-mcp-lines">
        {(props.health?.lines ?? ["Not tested"]).map((line, index) => (
          <span key={`${index}:${line}`}>{line}</span>
        ))}
        {status === "ready" && props.health?.testedAt ? (
          <span>{testedClock(props.health.testedAt)}</span>
        ) : null}
      </div>
    </div>
  );
}

export function McpServersPanel() {
  const [servers, setServers] = useState<readonly DraftServer[]>([]);
  const [health, setHealth] = useState<McpServerHealth>();
  const [draft, setDraft] = useState<DraftServer>(blank);
  const [editing, setEditing] = useState<number>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshHealth = (signal?: AbortSignal) =>
    loadMcpHealth(signal).then((next) => {
      if (!signal?.aborted) setHealth(next);
    });

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      loadMcpServers(controller.signal),
      loadMcpHealth(controller.signal),
    ])
      .then(([catalog, nextHealth]) => {
        if (controller.signal.aborted) return;
        setServers(catalog.servers);
        setHealth(nextHealth);
      })
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
  const saved = (catalog: { servers: readonly DraftServer[] }) => {
    setServers(catalog.servers);
    setNotice(
      "Saved. An active chat keeps its current MCP catalog until a new session starts.",
    );
    return refreshHealth();
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
        setDraft(blank());
        setEditing(undefined);
        return saved(catalog);
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
        if (editing === index) {
          setEditing(undefined);
          setDraft(blank());
        }
        return saved(catalog);
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
      .then((catalog) => saved(catalog))
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Save failed."),
      )
      .finally(() => setBusy(false));
  };
  const test = (name: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    void probeMcpServer(name)
      .then((next) => {
        setHealth(next);
        setNotice("Tested with a temporary MCP process. The active chat was not changed.");
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "MCP test failed."),
      )
      .finally(() => setBusy(false));
  };

  return (
    <section className="a008-mcp" aria-label="MCP servers">
      <h3>MCP servers</h3>
      <p>
        Configure approved local stdio servers. A008 starts them only through
        the shared tool session, and each MCP tool call still needs approval.
        Reload &amp; Test uses a temporary process and does not change an active
        chat. Saved changes apply when a new session is constructed.
      </p>
      <McpServerList
        servers={servers}
        health={health}
        busy={busy}
        onEdit={edit}
        onToggle={toggle}
        onRemove={remove}
        onTest={test}
      />
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
