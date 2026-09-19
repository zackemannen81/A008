import { useEffect, useState } from "react";
import {
  addNvidiaModel,
  loadKieCatalog,
  loadNvidiaCatalog,
  loadProviderSettings,
  saveProviderSettings,
  type KieCatalog,
  type NvidiaCatalog,
  type ProviderSettings,
} from "./nvidia-catalog.js";

export function NvidiaCatalogPanel() {
  const [catalog, setCatalog] = useState<NvidiaCatalog>();
  const [kieCatalog, setKieCatalog] = useState<KieCatalog>();
  const [settings, setSettings] = useState<ProviderSettings>();
  const [query, setQuery] = useState("");
  const [key, setKey] = useState("");
  const [kieKey, setKieKey] = useState("");
  const [openAiKey, setOpenAiKey] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [imageEndpoint, setImageEndpoint] = useState("");
  const [chatProvider, setChatProvider] = useState<"nvidia" | "kie" | "openai">(
    "nvidia",
  );
  const [imageProvider, setImageProvider] = useState<"nvidia" | "kie">(
    "nvidia",
  );
  const [kieChatModel, setKieChatModel] = useState("");
  const [kieChatEndpoint, setKieChatEndpoint] = useState("");
  const [kieImageModel, setKieImageModel] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh(signal?: AbortSignal) {
    const next = await loadProviderSettings(signal);
    setSettings(next);
    setImageModel(next.imageModel);
    setImageEndpoint(next.imageEndpoint);
    setChatProvider(next.chatProvider);
    setImageProvider(next.imageProvider);
    setKieChatModel(next.kieChatModel);
    setKieChatEndpoint(next.kieChatEndpoint);
    setKieImageModel(next.kieImageModel);
    try {
      setKieCatalog(await loadKieCatalog(signal));
    } catch {
      setKieCatalog(undefined);
    }
    try {
      setCatalog(await loadNvidiaCatalog(signal));
    } catch (reason) {
      setCatalog(undefined);
      if (!signal?.aborted) {
        setError(
          reason instanceof Error ? reason.message : "Catalog unavailable.",
        );
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch((reason) => {
      if (!controller.signal.aborted) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Provider settings failed.",
        );
      }
    });
    return () => controller.abort();
  }, []);

  const visible =
    catalog?.models.filter((model) =>
      query.trim()
        ? model.id.toLowerCase().includes(query.trim().toLowerCase())
        : true,
    ) ?? [];

  return (
    <section className="a008-catalog" aria-label="NVIDIA Build catalog">
      <h3>Provider</h3>
      <p>
        Browse models your NVIDIA API key can invoke. Preview NIMs are listed on{" "}
        <a href="https://build.nvidia.com/models?filters=nimType%3Anim_type_preview">
          NVIDIA Build
        </a>
        . Free Endpoint is hosted inference against NGC credits, not an
        unlimited free quota.
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
      <h3>kie.ai</h3>
      <p>
        Aggregator for chat, image and video models. Docs:{" "}
        <a href="https://docs.kie.ai/">docs.kie.ai</a>. Chat uses
        OpenAI-compatible completions; images use async Market jobs. Video is
        listed but not wired in this slice.
      </p>
      <p>
        kie.ai API key:{" "}
        {settings?.kieApiKeyConfigured
          ? `configured (${settings.kieKeySource})`
          : "missing"}
      </p>
      <label>
        kie.ai API key
        <input
          type="password"
          autoComplete="off"
          value={kieKey}
          placeholder="write only; never shown again"
          onChange={(event) => setKieKey(event.target.value)}
        />
      </label>
      <h3>OpenAI</h3>
      <p>
        GPT-5.6 Luna and GPT-5.6 Terra are built-in chat profiles on the native
        embedded OpenAI Responses route. The key stays on the A008 host and is
        write-only from this panel.
      </p>
      <p>
        OpenAI API key:{" "}
        {settings?.openAiApiKeyConfigured
          ? `configured (${settings.openAiKeySource})`
          : "missing"}
      </p>
      <label>
        OpenAI API key
        <input
          type="password"
          autoComplete="off"
          value={openAiKey}
          placeholder="sk-…  (write only; never shown again)"
          onChange={(event) => setOpenAiKey(event.target.value)}
        />
      </label>
      <label>
        Chat provider
        <select
          value={chatProvider}
          onChange={(event) => {
            const value = event.target.value;
            setChatProvider(
              value === "openai"
                ? "openai"
                : value === "kie"
                  ? "kie"
                  : "nvidia",
            );
          }}
        >
          <option value="nvidia">NVIDIA</option>
          <option value="openai">OpenAI</option>
          <option value="kie">kie.ai</option>
        </select>
      </label>
      <label>
        Image provider
        <select
          value={imageProvider}
          onChange={(event) =>
            setImageProvider(event.target.value === "kie" ? "kie" : "nvidia")
          }
        >
          <option value="nvidia">NVIDIA</option>
          <option value="kie">kie.ai</option>
        </select>
      </label>
      <label>
        kie.ai chat model
        <input
          value={kieChatModel}
          onChange={(event) => setKieChatModel(event.target.value)}
        />
      </label>
      <label>
        kie.ai chat endpoint
        <input
          value={kieChatEndpoint}
          onChange={(event) => setKieChatEndpoint(event.target.value)}
        />
      </label>
      <label>
        kie.ai image model
        <input
          value={kieImageModel}
          onChange={(event) => setKieImageModel(event.target.value)}
        />
      </label>
      <label>
        NVIDIA image model
        <input
          value={imageModel}
          onChange={(event) => setImageModel(event.target.value)}
        />
      </label>
      <label>
        NVIDIA image endpoint
        <input
          value={imageEndpoint}
          onChange={(event) => setImageEndpoint(event.target.value)}
        />
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
            ...(kieKey.trim() ? { kieApiKey: kieKey.trim() } : {}),
            ...(openAiKey.trim() ? { openAiApiKey: openAiKey.trim() } : {}),
            imageModel,
            imageEndpoint,
            chatProvider,
            imageProvider,
            kieChatModel,
            kieChatEndpoint,
            kieImageModel,
          })
            .then((next) => {
              setSettings(next);
              setKey("");
              setKieKey("");
              setOpenAiKey("");
              setNotice(
                key.trim() || kieKey.trim() || openAiKey.trim()
                  ? "Saved. Reconnect the session so chat uses the new key."
                  : "Provider settings saved.",
              );
            })
            .catch((reason) => {
              setError(
                reason instanceof Error ? reason.message : "Save failed.",
              );
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
              setError(
                reason instanceof Error ? reason.message : "Refresh failed.",
              );
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
                  .then(() =>
                    setNotice(
                      `Added ${model.id}. It appears in the Model list.`,
                    ),
                  )
                  .catch((reason) => {
                    setError(
                      reason instanceof Error ? reason.message : "Add failed.",
                    );
                  })
                  .finally(() => setBusy(false));
              }}
            >
              {model.added ? "Added" : "Add"}
            </button>
          </li>
        ))}
      </ul>
      {visible.length > 80 ? (
        <p>Showing 80 of {visible.length}. Filter to narrow.</p>
      ) : null}
      {kieCatalog ? (
        <>
          <h3>kie.ai market (curated)</h3>
          <p className="a008-catalog-note">{kieCatalog.note}</p>
          <ul>
            {kieCatalog.models.map((model) => (
              <li key={model.id}>
                <code>{model.id}</code>
                <span>{model.kind}</span>
                <button
                  type="button"
                  disabled={busy || model.added || model.kind === "video"}
                  onClick={() => {
                    setBusy(true);
                    setError("");
                    const work =
                      model.kind === "image"
                        ? saveProviderSettings({
                            imageProvider: "kie",
                            kieImageModel: model.id,
                          })
                        : model.kind === "video"
                          ? Promise.reject(
                              new Error(
                                "Video models are listed but not wired yet.",
                              ),
                            )
                          : addNvidiaModel(model.id, fetch, "kie").then(() =>
                              saveProviderSettings({
                                chatProvider: "kie",
                                kieChatModel: model.id,
                                kieChatEndpoint: `https://api.kie.ai/${encodeURIComponent(model.id)}/v1/chat/completions`,
                              }),
                            );
                    void work
                      .then(() => refresh())
                      .then(() => setNotice(`Selected ${model.id}.`))
                      .catch((reason) => {
                        setError(
                          reason instanceof Error
                            ? reason.message
                            : "Add failed.",
                        );
                      })
                      .finally(() => setBusy(false));
                  }}
                >
                  {model.kind === "video"
                    ? "Not wired"
                    : model.added
                      ? "Added"
                      : "Use"}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  );
}
