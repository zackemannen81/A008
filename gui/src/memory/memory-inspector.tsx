import {
  KIND_LABEL,
  type MemoryRecord,
  type MemorySnapshot,
} from "./memory-client.js";

export function storedConnections(id: string, graph: MemorySnapshot["graph"]) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  return graph.edges.flatMap((edge) => {
    if (edge.from !== id && edge.to !== id) return [];
    const record = nodes.get(edge.from === id ? edge.to : edge.from);
    return record
      ? [
          {
            record,
            relation: edge.relation,
            direction:
              edge.from === edge.to
                ? "self"
                : edge.from === id
                  ? "outgoing"
                  : "incoming",
          },
        ]
      : [];
  });
}

function parseDetail(detail: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(detail);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function textField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function numberField(value: unknown): string | undefined {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : undefined;
}

function provenanceDepth(value: unknown, depth = 0, seen = new Set<unknown>()): number {
  if (!value || typeof value !== "object" || seen.has(value)) return depth;
  seen.add(value);
  if (Array.isArray(value)) return Math.max(depth, ...value.map((item) => provenanceDepth(item, depth, seen)));
  const object = value as Record<string, unknown>;
  const nested = [object.provenance, object.parent, object.source, object.derivedFrom].filter(Boolean);
  return nested.length ? Math.max(...nested.map((item) => provenanceDepth(item, depth + 1, seen))) : depth;
}

export function MemoryInspector({
  record,
  relatedCount,
  connections,
  onSelect,
  onClose,
}: {
  record: MemoryRecord | undefined;
  relatedCount?: number;
  connections?: ReturnType<typeof storedConnections>;
  onSelect?: (record: MemoryRecord) => void;
  onClose: () => void;
}) {
  const parsed = record ? parseDetail(record.detail) : undefined;
  const content =
    textField(parsed?.content) ??
    textField(parsed?.proposition) ??
    textField(parsed?.text) ??
    record?.label;
  const summary = record
    ? {
        incoming: connections?.filter((connection) => connection.direction === "incoming").length ?? 0,
        outgoing: connections?.filter((connection) => connection.direction === "outgoing").length ?? 0,
        contested: connections?.filter((connection) => connection.relation.toLowerCase().includes("contest")).length ?? 0,
      }
    : { incoming: 0, outgoing: 0, contested: 0 };
  const depth = record ? provenanceDepth(parsed) : 0;
  const rows = record
    ? [
        ["Type", KIND_LABEL[record.kind]],
        ["Status", record.status],
        [
          "Evidence activation",
          record.activation === "untracked"
            ? "Not tracked on this record"
            : record.activation,
        ],
        ["Created", textField(parsed?.created) ?? textField(parsed?.createdAt)],
        [
          "Last accessed",
          textField(parsed?.lastAccessed) ?? textField(parsed?.accessedAt),
        ],
        ["Access count", numberField(parsed?.accessCount)],
        ["Confidence", numberField(parsed?.confidence)],
        [
          "Links",
          relatedCount !== undefined
            ? `${relatedCount} stored links in this view`
            : undefined,
        ],
      ].filter((row): row is [string, string] => row[1] !== undefined)
    : [];
  return (
    <aside
      className="memory-inspector memory-card"
      aria-label="Record inspector"
    >
      <div className="memory-section-heading">
        <h2>Record inspector</h2>
        {record ? (
          <button onClick={onClose} aria-label="Close record inspector">
            ×
          </button>
        ) : null}
      </div>
      {record ? (
        <>
          <div className="memory-inspector-summary">
            <div className="memory-inspector-summary-status">
              <span className={`memory-badge memory-kind-${record.kind}`}>{KIND_LABEL[record.kind]}</span>
              <span className="memory-chip">{record.status} · {record.activation}</span>
            </div>
            <h3>{content}</h3>
            <p className="memory-inspector-summary-relations">
              Incoming: {summary.incoming} · Outgoing: {summary.outgoing} · Contested: {summary.contested} · Provenance depth: {depth}
            </p>
          </div>
          <span className={`memory-badge memory-kind-${record.kind}`}>
            {KIND_LABEL[record.kind]}
          </span>
          <h3>{content}</h3>
          <dl className="memory-inspector-id">
            <dt>Record ID</dt>
            <dd>{record.sourceId}</dd>
          </dl>
          <div className="memory-chip-block">
            <span>Domains</span>
            <div>
              {record.domains.length === 0 ? (
                <em>None stored</em>
              ) : (
                record.domains.map((domain) => (
                  <span key={domain} className="memory-chip">
                    {domain}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="memory-chip-block">
            <span>Tags</span>
            <div>
              {record.tags.length === 0 ? (
                <em>None stored</em>
              ) : (
                record.tags.map((tag) => (
                  <span key={tag} className="memory-chip">
                    {tag}
                  </span>
                ))
              )}
            </div>
          </div>
          <table className="memory-inspector-table">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {connections && onSelect ? (
            <div className="memory-stored-connections">
              <h3>
                Connected records <span>{connections.length} links</span>
              </h3>
              {connections.length ? (
                <ul>
                  {connections.map((connection, index) => (
                    <li
                      key={`${connection.record.id}:${connection.direction}:${connection.relation}:${index}`}
                    >
                      <button onClick={() => onSelect(connection.record)}>
                        <span className="memory-connection-relation">
                          {connection.direction === "outgoing"
                            ? "→"
                            : connection.direction === "incoming"
                              ? "←"
                              : "↻"}{" "}
                          {connection.relation} · {connection.direction}
                        </span>
                        <span>
                          {connection.record.label ||
                            connection.record.sourceId}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="memory-muted">
                  No stored links in this bounded view.
                </p>
              )}
            </div>
          ) : null}
          <details>
            <summary>Content</summary>
            {record.truncated ? (
              <p className="memory-warning">
                Long text is truncated for inspection (16,000 characters of
                details / 500 of label).
              </p>
            ) : null}
            <pre>{record.detail}</pre>
          </details>
        </>
      ) : (
        <div className="memory-empty-small">
          <span className="memory-inspector-symbol" aria-hidden="true">
            ⌕
          </span>
          <p>
            Select a record to inspect its stored fields, attribution and
            provenance.
          </p>
        </div>
      )}
    </aside>
  );
}
