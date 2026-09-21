import { useEffect, useMemo, useState } from "react";
import type {
  GuiModel,
  ZeroCostCatalog,
  ZeroCostModelRouteDto,
} from "../../../packages/protocol/src/index.js";
import { loadModels } from "../session/session-controls.js";
import {
  addZeroCostModel,
  loadZeroCostCatalog,
  refreshZeroCostCatalog,
  zeroCostImportBlockReason,
} from "./zero-cost-radar.js";

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
function routeModelId(route: ZeroCostModelRouteDto): string {
  return route.a008ProfileId ?? route.modelId;
}

export function ZeroCostRadarPanel(props: {
  models: readonly GuiModel[];
  onModelsChanged: (models: readonly GuiModel[]) => void;
}) {
  const [catalog, setCatalog] = useState<ZeroCostCatalog>();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string>();

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
  const modelIds = useMemo(
    () => new Set(props.models.map((model) => model.id)),
    [props.models],
  );
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

  const availableCount =
    catalog?.routes.filter((route) => modelIds.has(routeModelId(route))).length ??
    0;
  const providers = new Set(
    catalog?.routes.map((route) => route.provider) ?? [],
  ).size;

  async function updateCheck() {
    setBusy("refresh");
    setError("");
    setNotice("");
    try {
      const latest = await refreshZeroCostCatalog();
      setCatalog(latest);
      setNotice(
        `Update check complete — verified ${latest.verifiedAt}, ${String(latest.routes.length)} routes.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Zero Cost Radar update check failed.",
      );
    } finally {
      setBusy(undefined);
    }
  }

  async function addRoute(route: ZeroCostModelRouteDto) {
    setBusy(route.key);
    setError("");
    setNotice("");
    try {
      await addZeroCostModel(route);
      const nextModels = await loadModels();
      props.onModelsChanged(nextModels);
      setNotice(`Added ${route.name}. It is now available in the Model list.`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not add that model.",
      );
    } finally {
      setBusy(undefined);
    }
  }
  return (
    <section className="a008-zero-cost-radar" aria-label="Zero Cost Radar">
      <header className="a008-radar-heading">
        <div>
          <p className="a008-radar-kicker">LIVE DISCOVERY</p>
          <h3>Zero Cost Radar</h3>
        </div>
        <div className="a008-radar-heading-actions">
          <span>{catalog ? "verified " + catalog.verifiedAt : "loading…"}</span>
          <button
            type="button"
            className="a008-radar-update"
            disabled={busy !== undefined}
            onClick={() => void updateCheck()}
          >
            {busy === "refresh" ? "Checking…" : "Update check"}
          </button>
        </div>
      </header>
      <p className="a008-radar-intro">
        Starts from A008&apos;s bundled validated snapshot. Update check fetches
        the latest published ZeroCostRadar feed on demand. Adding a model never
        changes the active provider, default model, routing, or paid fallback.
      </p>
      <div className="a008-radar-summary">
        <div>
          <strong>{catalog?.routes.length ?? "—"}</strong>
          <span>routes</span>
        </div>
        <div>
          <strong>{availableCount}</strong>
          <span>available in A008</span>
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
      {notice ? (
        <p className="a008-parameter-success" role="status">
          {notice}
        </p>
      ) : null}
      <div className="a008-radar-list">
        {visible.map((route) => {
          const available = modelIds.has(routeModelId(route));
          const blocked = zeroCostImportBlockReason(route);
          const canAdd = !available && blocked === undefined;
          return (
            <article className="a008-radar-card" key={route.key}>
              <div className="a008-radar-card-heading">
                <div>
                  <strong>{route.name}</strong>
                  <code>{route.modelId}</code>
                </div>
                <div className="a008-radar-card-actions">
                  <span
                    className={
                      available
                        ? "a008-radar-ready"
                        : "a008-radar-discovery"
                    }
                  >
                    {available ? "IN A008" : "DISCOVERY"}
                  </span>
                  <button
                    type="button"
                    className="a008-radar-add"
                    aria-label={`Add ${route.name} to A008`}
                    title={
                      available
                        ? "This model is already available in A008."
                        : blocked ?? `Add ${route.name} to A008`
                    }
                    disabled={!canAdd || busy !== undefined}
                    onClick={() => void addRoute(route)}
                  >
                    {available ? "✓" : busy === route.key ? "…" : "+"}
                  </button>
                </div>
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
              {!available && blocked ? (
                <p className="a008-radar-import-note">{blocked}</p>
              ) : null}
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
          );
        })}
      </div>
      {catalog && visible.length === 0 ? (
        <p className="a008-parameter-footnote">
          No radar routes match that filter.
        </p>
      ) : null}
    </section>
  );
}
