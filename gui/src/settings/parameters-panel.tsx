import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { GuiSession } from "../session/types.js";
import {
  loadModels,
  type GuiModel,
  type SessionParameters,
} from "../session/session-controls.js";
import { controlSession } from "../composer/submit.js";
import "./parameters.css";
import { GlobalSettingsForm } from "./global-settings-form.js";
import { NvidiaCatalogPanel } from "./nvidia-catalog-panel.js";

const numberValue = (value: number | null): number | "" =>
  value !== null && Number.isFinite(value) ? value : "";

function Toggle(props: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="a008-parameter-toggle">
      <span>{props.label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.checked)}
      />
    </label>
  );
}

function Sampling(props: {
  label: string;
  value: number | null;
  fallback: number;
  onChange: (value: number | null) => void;
}) {
  const id = useId();
  return (
    <div className="a008-parameter-group">
      <Toggle
        label={props.label}
        checked={props.value !== null}
        onChange={(on) => props.onChange(on ? props.fallback : null)}
      />
      <div className="a008-parameter-slider">
        <input
          aria-label={`${props.label} slider`}
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={props.value !== null && Number.isFinite(props.value) ? props.value : props.fallback}
          disabled={props.value === null}
          onChange={(event) => props.onChange(Number(event.target.value))}
        />
        <input
          id={id}
          aria-label={`${props.label} value`}
          type="number"
          min="0"
          max="1"
          step="0.01"
          required
          value={numberValue(props.value)}
          disabled={props.value === null}
          onChange={(event) => props.onChange(event.target.valueAsNumber)}
        />
      </div>
      <p>
        {props.value === null
          ? "Omitted from the request; provider default applies."
          : "0 · focused                         1 · varied"}
      </p>
    </div>
  );
}

function ParameterForm(props: {
  session: GuiSession;
  model: GuiModel;
  initial: SessionParameters;
}) {
  const { session, model } = props;
  const caps = model.capabilities;
  const [draft, setDraft] = useState<SessionParameters>(() => ({
    ...props.initial,
  }));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof SessionParameters>(
    key: K,
    value: SessionParameters[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice("");
    setError("");
  };
  async function apply(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const state = await controlSession(session, {
        action: "configure",
        parameters: draft,
      });
      setDraft({ ...state.parameters });
      setNotice("Applied to the next chat message.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not apply parameters.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <form
      onSubmit={(event) => {
        void apply(event);
      }}
      className="a008-parameter-form"
    >
      <fieldset disabled={saving || session.busy || session.status !== "ready"}>
        <Toggle
          label="Stream"
          checked={draft.stream}
          onChange={(value) => update("stream", value)}
        />
        <div className="a008-parameter-group">
          {caps.thinking ? (
            <Toggle
              label="Reasoning"
              checked={draft.enableThinking !== false}
              onChange={(value) => update("enableThinking", value)}
            />
          ) : (
            <h3>Reasoning effort</h3>
          )}
          {caps.reasoningEfforts.length > 0 ? (
            <div
              className="a008-effort-options"
              role="group"
              aria-label="Reasoning effort"
            >
              <label>
                <input
                  type="radio"
                  name="effort"
                  checked={draft.reasoningEffort === null}
                  onChange={() => update("reasoningEffort", null)}
                />
                Default
              </label>
              {caps.reasoningEfforts.map((effort) => (
                <label key={effort}>
                  <input
                    type="radio"
                    name="effort"
                    checked={draft.reasoningEffort === effort}
                    onChange={() => update("reasoningEffort", effort)}
                  />
                  {effort === "none" ? "None (off)" : effort}
                </label>
              ))}
            </div>
          ) : !caps.thinking ? (
            <p>This endpoint exposes no reasoning control.</p>
          ) : null}
          {caps.reasoningEfforts.length > 0 &&
          !caps.reasoningEfforts.includes("none") ? (
            <p>This model does not expose reasoning off.</p>
          ) : null}
          {caps.reasoningBudget !== null ? (
            <div className="a008-reasoning-budget">
              <Toggle
                label="Set reasoning budget"
                checked={draft.reasoningBudget !== null}
                disabled={draft.enableThinking === false}
                onChange={(on) =>
                  update(
                    "reasoningBudget",
                    on ? Math.min(4096, draft.maxTokens) : null,
                  )
                }
              />
              <input
                aria-label="Reasoning budget"
                type="number"
                min="-1"
                max={caps.reasoningBudget}
                step="1"
                required
                disabled={
                  draft.enableThinking === false ||
                  draft.reasoningBudget === null
                }
                value={numberValue(draft.reasoningBudget)}
                onChange={(event) =>
                  update("reasoningBudget", event.target.valueAsNumber)
                }
              />
              <p>
                Part of the total budget below. −1 removes the reasoning cap.
              </p>
            </div>
          ) : null}
        </div>
        <Sampling
          label="Temperature"
          value={draft.temperature}
          fallback={model.defaults.temperature ?? 1}
          onChange={(value) => update("temperature", value)}
        />
        {caps.topP ? (
          <Sampling
            label="Top P"
            value={draft.topP}
            fallback={model.defaults.topP ?? 0.95}
            onChange={(value) => update("topP", value)}
          />
        ) : (
          <div className="a008-parameter-group">
            <h3>Top P</h3>
            <p>Fixed by this model; no request override.</p>
          </div>
        )}
        <div className="a008-parameter-group">
          <label>
            Total token budget
            <input
              aria-label="Total token budget"
              type="number"
              required
              min="1"
              max={caps.maxTokens}
              step="1"
              value={numberValue(draft.maxTokens)}
              onChange={(event) =>
                update("maxTokens", event.target.valueAsNumber)
              }
            />
          </label>
          <p>
            Maximum generated tokens per chat call: reasoning + answer. Excludes
            input tokens and memory processing. Limit:{" "}
            {caps.maxTokens.toLocaleString()}.
          </p>
          {draft.enableThinking !== false &&
          draft.reasoningBudget !== null &&
          draft.reasoningBudget >= draft.maxTokens ? (
            <p className="a008-budget-note">
              Leave room for the answer; reasoning can use the entire budget.
            </p>
          ) : null}
        </div>
        {caps.seed ? (
          <div className="a008-parameter-group">
            <Toggle
              label="Seed"
              checked={draft.seed !== null}
              onChange={(on) => update("seed", on ? 42 : null)}
            />
            <input
              aria-label="Seed value"
              type="number"
              min="0"
              max={Number.MAX_SAFE_INTEGER}
              step="1"
              required
              disabled={draft.seed === null}
              value={numberValue(draft.seed)}
              onChange={(event) => update("seed", event.target.valueAsNumber)}
            />
            <p>
              Optional reproducibility hint; identical output is not guaranteed.
            </p>
          </div>
        ) : null}
        {caps.stop ? (
          <div className="a008-parameter-group">
            <label>
              Stop sequences
              <textarea
                aria-label="Stop sequences"
                rows={3}
                value={draft.stop?.join("\n") ?? ""}
                onChange={(event) =>
                  update(
                    "stop",
                    event.target.value === ""
                      ? null
                      : event.target.value.split("\n"),
                  )
                }
              />
            </label>
            <p>One per line, up to four. Empty means no custom stop.</p>
          </div>
        ) : null}
        <div className="a008-parameter-actions">
          <button
            type="button"
            onClick={() => {
              setDraft({ ...model.defaults });
              setNotice("Model defaults loaded. Apply to use them.");
              setError("");
            }}
          >
            Model defaults
          </button>
          <button type="submit" className="a008-parameter-apply">
            {saving ? "Applying…" : "Apply parameters"}
          </button>
        </div>
      </fieldset>
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
      <p className="a008-parameter-footnote">
        Settings belong to this session. A model change or new session loads
        runtime defaults.
      </p>
    </form>
  );
}

export function ParametersPanel(props: {
  session: GuiSession;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [models, setModels] = useState<readonly GuiModel[]>([]);
  const [page, setPage] = useState<"model" | "budgets" | "instructions" | "provider">(
    props.session.error?.includes("hard budget") ? "budgets" : "model",
  );
  const [error, setError] = useState("");
  const { session } = props;
  const model = models.find((m) => m.id === session.model);
  const close = () => {
    dialog.current?.close();
    props.onClose();
  };
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    const abort = new AbortController();
    void loadModels(abort.signal)
      .then(setModels)
      .catch((caught) => {
        if (!abort.signal.aborted)
          setError(
            caught instanceof Error ? caught.message : "Cannot load models.",
          );
      });
    return () => {
      abort.abort();
      node?.close();
    };
  }, []);
  async function changeModel(id: string) {
    setError("");
    try {
      await controlSession(session, { action: "model", model: id });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Model change failed.",
      );
    }
  }
  return (
    <dialog
      ref={dialog}
      className="a008-parameters"
      aria-labelledby="a008-parameters-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header>
        <div>
          <p>CHAT CONFIGURATION</p>
          <h2 id="a008-parameters-title">Parameters</h2>
        </div>
        <button type="button" aria-label="Close parameters" onClick={close}>
          ×
        </button>
      </header>
      <div className="a008-parameters-body">
        <nav className="a008-parameter-tabs" aria-label="Parameter sections">
          {(["model", "provider", "budgets", "instructions"] as const).map(tab => (
            <button key={tab} type="button" aria-pressed={page === tab} onClick={() => setPage(tab)}>
              {tab === "model" ? "Model" : tab === "provider" ? "Provider" : tab === "budgets" ? "Budgets" : "Instructions"}
            </button>
          ))}
        </nav>
        <div hidden={page !== "model"}>
        <label className="a008-model-select">
          Model
          <select
            aria-label="Selected model"
            value={session.model}
            disabled={
              session.status !== "ready" || session.busy || models.length === 0
            }
            onChange={(event) => {
              void changeModel(event.target.value);
            }}
          >
            {models.length === 0 ? (
              <option value={session.model}>{session.model}</option>
            ) : (
              models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))
            )}
          </select>
        </label>
        <p className="a008-parameter-footnote">
          Changing model starts a new conversation.
        </p>
        </div>
        {session.status !== "ready" ? (
          <div className="a008-parameter-connect">
            <p>Connect to inspect and change the active session.</p>
            <button
              type="button"
              disabled={session.status === "connecting"}
              onClick={() => {
                void session.connect();
              }}
            >
              {session.status === "connecting" ? "Connecting…" : "Connect"}
            </button>
          </div>
        ) : null}
        {error || session.error ? (
          <p className="a008-parameter-error" role="alert">
            {error || session.error}
          </p>
        ) : null}
        <div hidden={page !== "provider"}>
          <NvidiaCatalogPanel />
        </div>
        <div hidden={page !== "model"}>
        {model ? (
          <ParameterForm
            key={`${session.sessionId ?? "idle"}/${model.id}`}
            session={session}
            model={model}
            initial={session.details?.parameters ?? model.defaults}
          />
        ) : !error ? (
          <p role="status">Loading model parameters…</p>
        ) : null}
        </div>
        {session.details?.runtimePreferences && (page === "budgets" || page === "instructions") ? (
          <GlobalSettingsForm key={session.sessionId} session={session} initial={session.details.runtimePreferences} page={page} />
        ) : page !== "model" && page !== "provider" && session.status === "ready" ? (
          <p role="status">Global settings are unavailable. Restart the current A008 host.</p>
        ) : null}
      </div>
    </dialog>
  );
}
