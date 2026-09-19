import { useEffect, useState } from "react";
import type { V2Info } from "../../../packages/protocol/src/index.js";
import {
  loadRuntimeCapabilities,
  STAGE4_FOUNDATION_FEATURES,
  STAGE4_REMAINING,
  stage4FoundationComplete,
} from "./runtime-capabilities.js";

function bytes(value: number): string {
  if (value >= 1024 * 1024)
    return (
      (value / (1024 * 1024)).toFixed(value % (1024 * 1024) ? 1 : 0) + " MiB"
    );
  if (value >= 1024)
    return (value / 1024).toFixed(value % 1024 ? 1 : 0) + " KiB";
  return value + " B";
}

export function RuntimeCapabilitiesPanel() {
  const [info, setInfo] = useState<V2Info>();
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void loadRuntimeCapabilities(controller.signal)
      .then(setInfo)
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Runtime discovery unavailable.",
          );
        }
      });
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <section
        className="a008-runtime-capabilities"
        aria-label="Runtime capabilities"
      >
        <p className="a008-radar-kicker">STABLE CLIENT API</p>
        <h3>Stage 4 runtime</h3>
        <p className="a008-parameter-error">{error}</p>
        <p className="a008-parameter-footnote">
          This host is not exposing V2 discovery. The bundled GUI still uses its
          existing V1 session contract; engine-panel mode may intentionally
          disable V2.
        </p>
      </section>
    );
  }

  if (!info) return <p role="status">Loading runtime capabilities…</p>;

  const foundation = stage4FoundationComplete(info);
  const available = new Set(info.features);

  return (
    <section
      className="a008-runtime-capabilities"
      aria-label="Runtime capabilities"
    >
      <div className="a008-runtime-heading">
        <div>
          <p className="a008-radar-kicker">STABLE CLIENT API</p>
          <h3>Stage 4 runtime</h3>
        </div>
        <span
          className={foundation ? "a008-radar-ready" : "a008-radar-discovery"}
        >
          {foundation ? "FOUNDATION ACTIVE" : "PARTIAL"}
        </span>
      </div>
      <p className="a008-radar-intro">
        The running host advertises V2 capabilities here. The bundled web GUI
        has not migrated to V2 yet; that remains Stage 5.
      </p>
      <dl className="a008-runtime-meta">
        <div>
          <dt>Protocol</dt>
          <dd>{info.protocol}</dd>
        </div>
        <div>
          <dt>Server</dt>
          <dd>{info.serverVersion}</dd>
        </div>
        <div>
          <dt>Instance</dt>
          <dd>
            <code>{info.serverInstanceId}</code>
          </dd>
        </div>
        <div>
          <dt>Auth</dt>
          <dd>{info.authProfiles.join(" · ")}</dd>
        </div>
      </dl>
      <h4>Stage 4 foundation</h4>
      <ul className="a008-runtime-features">
        {STAGE4_FOUNDATION_FEATURES.map((feature) => (
          <li key={feature} data-available={available.has(feature)}>
            <span aria-hidden="true">{available.has(feature) ? "✓" : "–"}</span>
            <code>{feature}</code>
          </li>
        ))}
      </ul>
      <h4>Still outside the implemented Stage 4 slice</h4>
      <ul className="a008-runtime-pending">
        {STAGE4_REMAINING.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h4>Advertised limits</h4>
      <dl className="a008-runtime-meta">
        <div>
          <dt>Prompt</dt>
          <dd>{bytes(info.limits.promptBytes)}</dd>
        </div>
        <div>
          <dt>Input frame</dt>
          <dd>{bytes(info.limits.inputFrameBytes)}</dd>
        </div>
        <div>
          <dt>Output frame</dt>
          <dd>{bytes(info.limits.outputFrameBytes)}</dd>
        </div>
        <div>
          <dt>Ticket TTL</dt>
          <dd>{Math.round(info.limits.ticketLifetimeMs / 1000)} s</dd>
        </div>
      </dl>
      <details className="a008-runtime-all-features">
        <summary>All advertised features ({info.features.length})</summary>
        <code>{info.features.join(" · ")}</code>
      </details>
    </section>
  );
}
