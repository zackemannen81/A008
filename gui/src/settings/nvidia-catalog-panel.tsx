import { useEffect, useState } from "react";
import {
  addNvidiaModel,
  loadNvidiaCatalog,
  loadProviderSettings,
  saveProviderSettings,
  type NvidiaCatalog,
  type ProviderSettings,
} from "./nvidia-catalog.js";

export function NvidiaCatalogPanel() {
  const [catalog, setCatalog] = useState<NvidiaCatalog>();
  const [settings, setSettings] = useState<ProviderSettings>();
  const [query, setQuery] = useState("");
  const [key, setKey] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [imageEndpoint, setImageEndpoint] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh(signal?: AbortSignal) {
    const next = await loadProviderSettings(signal);
    setSettings(next);
    setImageModel(next.imageModel);
    setImageEndpoint(next.imageEndpoint);
    try {
      setCatalog(await loadNvidiaCatalog(signal));
    } catch (reason) {
      setCatalog(undefined);
      if (!signal?.aborted) {
        setError(reason instanceof Error ? reason.message : "Catalog unavailable.");
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch((reason) => {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : "Provider settings failed.");
      }
    });
    return () => controller.abort();
  }, []);

  const visible =
    catalog?.models.filter((model) =>
      query.trim() ? model.id.toLowerCase().includes(query.trim().toLowerCase()) : true,
    ) ?? [];

  return (
    <section className="a008-catalog" aria-label="NVIDIA Build catalog">
      <h3>Provider</h3>
      <p>
        Browse models your NVIDIA API key can invoke. Preview NIMs are listed on{" "}
        <a href="https://build.nvidia.com/models?filters=nimType%3Anim_type_preview">
          NVIDIA Build
        </a>
        . Free Endpoint is hosted inference against NGC credits, not an unlimited
        free quota.
      </p>
      <p>
        API key:{" "}
        {settings?.nvidiaApiKeyConfigured
          ? `configured (${settings.keySource})`
          : "missing"}
      </p>
      <label>
        NVIDIA API key
        <input
          type="password"
          autoComplete="off"
          value={key}
          placeholder="nvapi-…  (write only; never shown again)"
          onChange={(event) => setKey(event.target.value)}
        />
      </label>
      <label>
        Image model
        <input value={imageModel} onChange={(event) => setImageModel(event.target.value)} />
      </label>
      <label>
        Image endpoint
        <input value={imageEndpoint} onChange={(event) => setImageEndpoint(event.target.value)} />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError("");
          setNotice("");
          void saveProviderSettings({
            ...(key.trim() ? { nvidiaApiKey: key.trim() } : {}),
            imageModel,
            imageEndpoint,
          })
            .then((next) => {
              setSettings(next);
              setKey("");
              setNotice(
                key.trim()
                  ? "Saved. Reconnect the session so chat uses the new key."
                  : "Image settings saved.",
              );
            })
            .catch((reason) => {
              setError(reason instanceof Error ? reason.message : "Save failed.");
            })
            .finally(() => setBusy(false));
        }}
      >
        Save provider settings
      </button>
      <label>
        Filter catalog
        <input
          type="search"
          value={query}
          placeholder="Filter by model id…"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError("");
          void refresh()
            .catch((reason) => {
              setError(reason instanceof Error ? reason.message : "Refresh failed.");
            })
            .finally(() => setBusy(false));
        }}
      >
        Refresh catalog
      </button>
      {catalog ? <p className="a008-catalog-note">{catalog.note}</p> : null}
      <ul>
        {visible.slice(0, 80).map((model) => (
          <li key={model.id}>
            <code>{model.id}</code>
            <span>{model.ownedBy}</span>
            <button
              type="button"
              disabled={busy || model.added}
              onClick={() => {
                setBusy(true);
                setError("");
                void addNvidiaModel(model.id)
                  .then(() => refresh())
                  .then(() => setNotice(`Added ${model.id}. It appears in the Model list.`))
                  .catch((reason) => {
                    setError(reason instanceof Error ? reason.message : "Add failed.");
                  })
                  .finally(() => setBusy(false));
              }}
            >
              {model.added ? "Added" : "Add"}
            </button>
          </li>
        ))}
      </ul>
      {visible.length > 80 ? <p>Showing 80 of {visible.length}. Filter to narrow.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  );
}
