import { useEffect, useMemo, useState } from "react";
import type { ZeroCostCatalog } from "../../../packages/protocol/src/index.js";
import { loadZeroCostCatalog } from "./zero-cost-radar.js";

function compactNumber(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function accessLabel(access: string): string {
  if (access === "free-endpoint") return "Free endpoint";
  if (access === "free-model") return "Zero-price model";
  return "Free tier";
}

export function ZeroCostRadarPanel() {
  const [catalog, setCatalog] = useState<ZeroCostCatalog>();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void loadZeroCostCatalog(controller.signal)
      .then(setCatalog)
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Zero Cost Radar unavailable.",
          );
        }
      });
    return () => controller.abort();
  }, []);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!catalog || !needle) return catalog?.routes ?? [];
    return catalog.routes.filter((route) =>
      [
        route.name,
        route.modelId,
        route.provider,
        route.access,
        route.lifecycle,
        ...(route.capabilities ?? []),
        ...(route.inputModalities ?? []),
      ].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [catalog, query]);

  const readyCount =
    catalog?.routes.filter((route) => route.a008ProfileId).length ?? 0;
  const providers = new Set(
    catalog?.routes.map((route) => route.provider) ?? [],
  ).size;

  return (
    <section className="a008-zero-cost-radar" aria-label="Zero Cost Radar">
      <header className="a008-radar-heading">
        <div>
          <p className="a008-radar-kicker">DISCOVERY ONLY</p>
          <h3>Zero Cost Radar</h3>
        </div>
        <span>{catalog ? "verified " + catalog.verifiedAt : "loading…"}</span>
      </header>
      <p className="a008-radar-intro">
        Validated zero-cost and free-tier routes from A008-0134. Radar entries
        do not register providers, change routing, or authorize paid fallback.
      </p>
      <div className="a008-radar-summary">
        <div>
          <strong>{catalog?.routes.length ?? "—"}</strong>
          <span>routes</span>
        </div>
        <div>
          <strong>{readyCount}</strong>
          <span>A008 profiles</span>
        </div>
        <div>
          <strong>{providers || "—"}</strong>
          <span>providers</span>
        </div>
      </div>
      <label className="a008-radar-search">
        Filter routes
        <input
          type="search"
          value={query}
          placeholder="provider, model, capability…"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {error ? (
        <p className="a008-parameter-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="a008-radar-list">
        {visible.map((route) => (
          <article className="a008-radar-card" key={route.key}>
            <div className="a008-radar-card-heading">
              <div>
                <strong>{route.name}</strong>
                <code>{route.modelId}</code>
              </div>
              <span
                className={
                  route.a008ProfileId
                    ? "a008-radar-ready"
                    : "a008-radar-discovery"
                }
              >
                {route.a008ProfileId ? "A008 READY" : "DISCOVERY"}
              </span>
            </div>
            <div className="a008-radar-badges">
              <span>{route.provider}</span>
              <span>{accessLabel(route.access)}</span>
              <span>{route.lifecycle}</span>
              {(route.inputModalities ?? []).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <dl className="a008-radar-meta">
              {route.contextWindow ? (
                <div>
                  <dt>Context</dt>
                  <dd>{compactNumber(route.contextWindow)} tokens</dd>
                </div>
              ) : null}
              {route.maxOutputTokens ? (
                <div>
                  <dt>Output</dt>
                  <dd>{compactNumber(route.maxOutputTokens)} tokens</dd>
                </div>
              ) : null}
              {route.quota ? (
                <div>
                  <dt>Quota</dt>
                  <dd>{route.quota}</dd>
                </div>
              ) : null}
              {route.expiresAt ? (
                <div>
                  <dt>Expires</dt>
                  <dd>{route.expiresAt}</dd>
                </div>
              ) : null}
            </dl>
            {(route.capabilities ?? []).length ? (
              <p className="a008-radar-capabilities">
                {route.capabilities?.join(" · ")}
              </p>
            ) : null}
            {route.note ? <p>{route.note}</p> : null}
            <p
              className={
                route.dataPolicy === "do-not-send-sensitive-data"
                  ? "a008-radar-policy a008-radar-policy-danger"
                  : "a008-radar-policy"
              }
            >
              {route.dataPolicy === "do-not-send-sensitive-data"
                ? "Do not send sensitive data."
                : "Review provider terms before sensitive use."}
            </p>
            <div className="a008-radar-sources">
              {route.sourceUrls.map((url, index) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  Source {index + 1}
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>
      {catalog && visible.length === 0 ? (
        <p className="a008-parameter-footnote">
          No radar routes match that filter.
        </p>
      ) : null}
    </section>
  );
}
