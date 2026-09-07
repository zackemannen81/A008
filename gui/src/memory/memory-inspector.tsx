import { KIND_LABEL, type MemoryRecord } from "./memory-client.js";

export function MemoryInspector({
  record,
  onClose,
}: {
  record: MemoryRecord | undefined;
  onClose: () => void;
}) {
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
          <span className={`memory-badge memory-kind-${record.kind}`}>
            {KIND_LABEL[record.kind]}
          </span>
          <h3>{record.label}</h3>
          <dl>
            <dt>Record ID</dt>
            <dd>{record.sourceId}</dd>
            <dt>Status</dt>
            <dd>{record.status}</dd>
            <dt>Evidence activation</dt>
            <dd>
              {record.activation === "untracked"
                ? "Not tracked on this record"
                : record.activation}
            </dd>
            <dt>Domains</dt>
            <dd>{record.domains.join(", ") || "None stored"}</dd>
            <dt>Tags</dt>
            <dd>{record.tags.join(", ") || "None stored"}</dd>
          </dl>
          <details open>
            <summary>Stored record details</summary>
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
