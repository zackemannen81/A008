import { KIND_LABEL, type MemoryRecord } from "./memory-client.js";

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
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function numberField(value: unknown): string | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : undefined;
}

export function MemoryInspector({
  record,
  relatedCount,
  onClose,
}: {
  record: MemoryRecord | undefined;
  relatedCount?: number;
  onClose: () => void;
}) {
  const parsed = record ? parseDetail(record.detail) : undefined;
  const content =
    textField(parsed?.content) ??
    textField(parsed?.proposition) ??
    textField(parsed?.text) ??
    record?.label;
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
            ? `${relatedCount} related records`
            : undefined,
        ],
      ].filter((row): row is [string, string] => row[1] !== undefined)
    : [];
  return (
    <aside className="memory-inspector memory-card" aria-label="Record inspector">
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
          <details open>
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
