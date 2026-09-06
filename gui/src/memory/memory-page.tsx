import { useEffect, useState } from "react";
import {
  EMPTY_FILTERS,
  KIND_LABEL,
  loadMemory,
  MEMORY_KINDS,
  type MemoryFilters,
  type MemoryKind,
  type MemoryRecord,
  type MemorySnapshot,
} from "./memory-client.js";
import { MemoryGraph } from "./memory-graph.js";
import { MemoryInspector } from "./memory-inspector.js";
import { MemoryOverview } from "./memory-overview.js";
import "./memory.css";

type View = "overview" | "graph" | "manager";
const VIEWS: readonly { id: View; label: string; title: string }[] = [
  { id: "overview", label: "Overview", title: "Memory Overview" },
  {
    id: "graph",
    label: "Relationship map",
    title: "Memory Relationship Map Graph",
  },
  {
    id: "manager",
    label: "Knowledge manager",
    title: "Memory Knowledge Manager",
  },
];

export function MemoryPage({ active }: { active: boolean }) {
  const [view, setView] = useState<View>("overview");
  const [filters, setFilters] = useState<MemoryFilters>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<MemorySnapshot>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [selected, setSelected] = useState<MemoryRecord>();
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    setSelected(undefined);
    void loadMemory(filters, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setSnapshot(data);
        setUpdatedAt(new Date().toLocaleTimeString());
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setSnapshot(undefined);
          setError(
            reason instanceof Error
              ? reason.message
              : "Memory inspection failed.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, filters, refresh]);
  function filter(patch: Partial<MemoryFilters>) {
    setFilters((current) => ({ ...current, ...patch, offset: 0 }));
  }
  function browse(kind?: MemoryKind, domain?: string) {
    setView("manager");
    setSearch("");
    setFilters({ ...EMPTY_FILTERS, kind: kind ?? "", domain: domain ?? "" });
    setSelected(undefined);
  }
  const title = VIEWS.find((candidate) => candidate.id === view)!.title;
  const statuses = [
    ...new Set(["active", "dormant", ...(snapshot?.summary.statuses ?? [])]),
  ];
  return (
    <section
      className="memory-page"
      aria-label="Memory diagnostics"
      aria-busy={loading}
    >
      <header className="memory-page-heading">
        <div>
          <span className="memory-eyebrow">Workspace / Memory</span>
          <h1>{title}</h1>
          <p>Explore the memory behind your conversations.</p>
        </div>
        <div className="memory-page-actions">
          <span className="memory-readonly">Read only</span>
          <button
            className="memory-button"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>
      </header>
      <nav className="memory-view-nav" aria-label="Memory views">
        {VIEWS.map((candidate) => (
          <button
            key={candidate.id}
            aria-current={view === candidate.id ? "page" : undefined}
            onClick={() => {
              setView(candidate.id);
              setSelected(undefined);
            }}
          >
            {candidate.label}
          </button>
        ))}
      </nav>
      <div className="memory-runtime" aria-live="polite">
        <span>
          {loading
            ? "Reading memory…"
            : error
              ? "Memory unavailable"
              : snapshot
                ? `${snapshot.durable ? "Persistent store" : "In-memory store"} · Updated ${updatedAt}`
                : "Memory not loaded"}
        </span>
        {snapshot && !error ? (
          <span title={snapshot.projectId}>Project · {snapshot.projectId}</span>
        ) : null}
      </div>
      {view !== "overview" ? (
        <form
          className="memory-filters"
          onSubmit={(event) => {
            event.preventDefault();
            filter({ query: search.trim() });
          }}
        >
          <label className="memory-search">
            <span>Search memory</span>
            <input
              value={search}
              maxLength={300}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search content, record IDs or tags…"
              type="search"
            />
          </label>
          <button className="memory-button" type="submit">
            Search
          </button>
          <label>
            <span>Surface</span>
            <select
              value={filters.kind}
              onChange={(event) => filter({ kind: event.target.value })}
            >
              <option value="">All surfaces</option>
              {MEMORY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Domain</span>
            <select
              value={filters.domain}
              onChange={(event) => filter({ domain: event.target.value })}
            >
              <option value="">All domains</option>
              {snapshot?.summary.domains.map((domain) => (
                <option key={domain.name} value={domain.name}>
                  {domain.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status / activation</span>
            <select
              value={filters.status}
              onChange={(event) => filter({ status: event.target.value })}
            >
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <button
            className="memory-button memory-button-quiet"
            type="button"
            onClick={() => {
              setSearch("");
              setFilters(EMPTY_FILTERS);
            }}
          >
            Clear filters
          </button>
        </form>
      ) : null}
      <div className="memory-content">
        {error ? (
          <div className="memory-state-message" role="alert">
            <h2>Memory could not be read</h2>
            <p>{error}</p>
            <p>Check the GUI host and its memory configuration, then retry.</p>
            <button
              className="memory-button"
              onClick={() => setRefresh((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="memory-state-message" role="status">
            <span className="memory-loader" />
            <h2>Reading the knowledge store</h2>
            <p>Fetching current records and their stored relationships.</p>
          </div>
        ) : snapshot ? (
          <>
            {snapshot.summary.total === 0 ? (
              <div className="memory-empty-banner">
                <strong>Your memory store is empty.</strong>
                <span>
                  Chat or upload a source to create evidence, then refresh. No
                  sample records are shown here.
                </span>
              </div>
            ) : null}
            {view === "overview" ? (
              <MemoryOverview snapshot={snapshot} onBrowse={browse} />
            ) : (
              <div className="memory-explorer">
                {view === "graph" ? (
                  <MemoryGraph
                    graph={snapshot.graph}
                    selected={selected?.id}
                    onSelect={setSelected}
                  />
                ) : (
                  <section
                    className="memory-card memory-manager"
                    aria-label="Memory knowledge manager"
                  >
                    <div className="memory-section-heading">
                      <h2>Knowledge inventory</h2>
                      <span>
                        {snapshot.matched.toLocaleString()} matching records
                      </span>
                    </div>
                    <div className="memory-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Record</th>
                            <th scope="col">Surface</th>
                            <th scope="col">Status</th>
                            <th scope="col">Domain</th>
                          </tr>
                        </thead>
                        <tbody>
                          {snapshot.records.map((record) => (
                            <tr
                              key={record.id}
                              data-selected={selected?.id === record.id}
                            >
                              <td>
                                <button
                                  className="memory-record-button"
                                  aria-pressed={selected?.id === record.id}
                                  onClick={() => setSelected(record)}
                                >
                                  {record.label || record.sourceId}
                                </button>
                                <span className="memory-record-id">
                                  {record.sourceId}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`memory-badge memory-kind-${record.kind}`}
                                >
                                  {KIND_LABEL[record.kind]}
                                </span>
                              </td>
                              <td>
                                {record.status}
                                <span className="memory-record-id">
                                  {record.activation === "untracked"
                                    ? ""
                                    : record.activation}
                                </span>
                              </td>
                              <td>{record.domains.join(", ") || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {snapshot.records.length === 0 ? (
                      <div className="memory-empty-small">
                        <h3>No matching records</h3>
                        <p>Try another search or clear the filters.</p>
                      </div>
                    ) : null}
                    <div className="memory-pagination">
                      <span>
                        {snapshot.records.length
                          ? `${snapshot.offset + 1}–${snapshot.offset + snapshot.records.length}`
                          : "0"}{" "}
                        of {snapshot.matched}
                      </span>
                      <div>
                        <button
                          className="memory-button"
                          disabled={snapshot.offset === 0}
                          onClick={() =>
                            setFilters((current) => ({
                              ...current,
                              offset: Math.max(
                                0,
                                current.offset - snapshot.limit,
                              ),
                            }))
                          }
                        >
                          Previous
                        </button>
                        <button
                          className="memory-button"
                          disabled={
                            snapshot.offset + snapshot.limit >= snapshot.matched
                          }
                          onClick={() =>
                            setFilters((current) => ({
                              ...current,
                              offset: current.offset + snapshot.limit,
                            }))
                          }
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </section>
                )}
                <MemoryInspector
                  record={selected}
                  onClose={() => setSelected(undefined)}
                />
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
