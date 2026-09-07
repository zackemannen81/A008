import {
  KIND_LABEL,
  MEMORY_KINDS,
  type MemoryKind,
  type MemorySnapshot,
} from "./memory-client.js";

export function MemoryOverview({
  snapshot,
  onBrowse,
}: {
  snapshot: MemorySnapshot;
  onBrowse: (kind?: MemoryKind, domain?: string) => void;
}) {
  const { summary } = snapshot;
  const largest = Math.max(1, ...summary.domains.map((domain) => domain.count));
  return (
    <div className="memory-overview">
      <div className="memory-metrics">
        {[
          ["Stored records", summary.total, "Across all memory surfaces"],
          ["Open bindings", summary.counts.state, "Current state"],
          [
            "Dormant evidence",
            summary.dormant,
            `${summary.active} active evidence records`,
          ],
          [
            "Contested slots",
            summary.contestedSlots,
            "Require a separate resolution policy",
          ],
        ].map(([label, value, hint]) => (
          <article className="memory-metric" key={label}>
            <span className="memory-eyebrow">{label}</span>
            <strong>{Number(value).toLocaleString()}</strong>
            <span>{hint}</span>
          </article>
        ))}
      </div>
      <div className="memory-overview-grid">
        <section className="memory-card">
          <div className="memory-section-heading">
            <h2>Inside the knowledge store</h2>
            <span>8 surfaces</span>
          </div>
          <p className="memory-muted">
            Inspect what was stored, what is accepted, and where it came from.
          </p>
          <div className="memory-surface-list">
            {MEMORY_KINDS.map((kind) => (
              <button
                key={kind}
                onClick={() => onBrowse(kind)}
                className="memory-surface-row"
              >
                <span>
                  <span className={`memory-kind-dot memory-kind-${kind}`} />
                  {KIND_LABEL[kind]}
                </span>
                <strong>
                  {summary.counts[kind].toLocaleString()}{" "}
                  <span aria-hidden="true">↗</span>
                </strong>
              </button>
            ))}
          </div>
        </section>
        <section className="memory-card">
          <div className="memory-section-heading">
            <h2>Stored domains</h2>
            <span>{summary.domains.length} domains</span>
          </div>
          <p className="memory-muted">
            Label attachments on claims and utterances.
          </p>
          {summary.domains.length === 0 ? (
            <p className="memory-empty-small">
              No domain labels have been stored yet.
            </p>
          ) : (
            <div className="memory-domain-list">
              {summary.domains.slice(0, 12).map((domain) => (
                <button
                  key={domain.name}
                  onClick={() => onBrowse(undefined, domain.name)}
                  className="memory-domain-row"
                >
                  <span>
                    {domain.name}
                    <strong>{domain.count}</strong>
                  </span>
                  <span className="memory-bar">
                    <span
                      style={{ width: `${(100 * domain.count) / largest}%` }}
                    />
                  </span>
                </button>
              ))}
            </div>
          )}
          {summary.domains.length > 12 ? (
            <p className="memory-muted">
              Showing the 12 largest domains. All domains are available in the
              filter.
            </p>
          ) : null}
        </section>
      </div>
      <section className="memory-card memory-boundary">
        <div>
          <span className="memory-eyebrow">
            Inspection, without side effects
          </span>
          <h2>Stored memory and recalled context are different views.</h2>
          <p>
            This page includes unaccepted claims, dormant evidence and history.
            A chat turn may recall only part of it. Viewing a record does not
            accept or reinforce it.
          </p>
        </div>
        <span className="memory-readonly">Read only</span>
      </section>
    </div>
  );
}
