import { useId, useState, type FormEvent } from "react";
import type { GuiSession } from "../session/types.js";
import { controlSession } from "../composer/submit.js";
import type { GuiModel } from "../session/session-controls.js";
import type {
  RuntimePreferences,
  RuntimePreferencesSnapshot,
} from "./runtime-preferences.js";

const copy = (settings: RuntimePreferences): RuntimePreferences => ({
  instructions: settings.instructions,
  budgets: { ...settings.budgets },
  ...(settings.semantic === undefined
    ? {}
    : { semantic: { ...settings.semantic } }),
});

export function GlobalSettingsForm({
  session,
  initial,
  page,
  models,
}: {
  session: GuiSession;
  initial: RuntimePreferencesSnapshot;
  page: "semantic" | "budgets" | "instructions";
  models: readonly GuiModel[];
}) {
  const id = useId();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(() => copy(initial.settings));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.settings);
  const stale = session.details?.runtimePreferences?.revision !== saved.revision;
  const fields = session.details?.runtimePreferences?.fields ?? saved.fields;
  const disabled = saving || session.busy || session.status !== "ready";
  const semantic = draft.semantic;
  const semanticModel =
    semantic === undefined
      ? undefined
      : models.find((model) => model.id === semantic.model);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const state = await controlSession(session, {
        action: "configureRuntime",
        settings: draft,
        revision: saved.revision,
      });
      if (!state.runtimePreferences) {
        throw new Error("Host did not return saved global settings.");
      }
      setSaved(state.runtimePreferences);
      setDraft(copy(state.runtimePreferences.settings));
      setNotice(
        state.runtimePreferences.storagePath === null
          ? "Applied for this host process. Persistence is disabled."
          : "Saved for all A008 projects. Applies to the next chat message, including after restart.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save global settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function reload() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const state = await controlSession(session, { action: "inspect" });
      if (!state.runtimePreferences) {
        throw new Error("Global settings are unavailable on this host.");
      }
      setSaved(state.runtimePreferences);
      setDraft(copy(state.runtimePreferences.settings));
      setNotice("Loaded saved global settings.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not reload settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  function edit(next: RuntimePreferences) {
    setDraft(next);
    setNotice("");
    setError("");
  }

  const semanticBudget = draft.budgets.semanticOutputTokens ?? 0;
  const semanticEffectiveMax =
    semanticModel === undefined
      ? semanticBudget
      : Math.min(semanticBudget, semanticModel.capabilities.maxTokens);

  return (
    <form
      className="a008-parameter-form"
      onSubmit={(event) => {
        void save(event);
      }}
    >
      <p className="a008-global-scope">GLOBAL · ALL PROJECTS</p>
      <fieldset disabled={disabled}>
        <div className="a008-global-actions">
          <button type="submit" disabled={!dirty || stale}>
            {saving ? "Saving…" : "Save global settings"}
          </button>
          <button
            type="button"
            className="a008-parameter-secondary"
            onClick={() => {
              void reload();
            }}
          >
            Reload saved settings
          </button>
        </div>

        <section hidden={page !== "semantic"} aria-label="Semantic model settings">
          {semantic === undefined ? (
            <p className="a008-parameter-error">
              This host predates explicit semantic-model settings. Restart with
              the current A008 host before changing semantic routing.
            </p>
          ) : (
            <>
              <div className="a008-parameter-group">
                <h3>
                  <label htmlFor={`${id}-semantic-model`}>Semantic model</label>
                </h3>
                <p>
                  Used for retrieval scope, knowledge extraction, relation
                  classification and source knowledge extraction. This is
                  independent of the chat model.
                </p>
                <select
                  id={`${id}-semantic-model`}
                  value={semantic.model}
                  onChange={(event) => {
                    const model = models.find(
                      (candidate) => candidate.id === event.target.value,
                    );
                    const keepEffort =
                      semantic.reasoningEffort !== null &&
                      model?.capabilities.reasoningEfforts.includes(
                        semantic.reasoningEffort,
                      );
                    edit({
                      ...draft,
                      semantic: {
                        model: event.target.value,
                        reasoningEffort: keepEffort
                          ? semantic.reasoningEffort
                          : null,
                      },
                    });
                  }}
                >
                  {semanticModel === undefined ? (
                    <option value={semantic.model}>{semantic.model}</option>
                  ) : null}
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>

              {semanticModel ? (
                <>
                  <div className="a008-parameter-group">
                    <h3>Semantic reasoning effort</h3>
                    {semanticModel.capabilities.reasoningEfforts.length > 0 ? (
                      <div
                        className="a008-effort-options"
                        role="group"
                        aria-label="Semantic reasoning effort"
                      >
                        <label>
                          <input
                            type="radio"
                            name="semantic-effort"
                            checked={semantic.reasoningEffort === null}
                            onChange={() =>
                              edit({
                                ...draft,
                                semantic: {
                                  ...semantic,
                                  reasoningEffort: null,
                                },
                              })
                            }
                          />
                          None (default)
                        </label>
                        {semanticModel.capabilities.reasoningEfforts
                          .filter((effort) => effort !== "none")
                          .map((effort) => (
                            <label key={effort}>
                              <input
                                type="radio"
                                name="semantic-effort"
                                checked={semantic.reasoningEffort === effort}
                                onChange={() =>
                                  edit({
                                    ...draft,
                                    semantic: {
                                      ...semantic,
                                      reasoningEffort: effort,
                                    },
                                  })
                                }
                              />
                              {effort}
                            </label>
                          ))}
                      </div>
                    ) : (
                      <p>
                        This model exposes no reasoning-effort control; A008 uses
                        its strict non-thinking semantic JSON profile.
                      </p>
                    )}
                  </div>
                  <div className="a008-parameter-group">
                    <h3>Semantic output</h3>
                    <p>
                      Effective maximum:{" "}
                      {semanticEffectiveMax.toLocaleString()} tokens. Global
                      semantic budget: {semanticBudget.toLocaleString()}; model
                      limit:{" "}
                      {semanticModel.capabilities.maxTokens.toLocaleString()}.
                    </p>
                  </div>
                </>
              ) : (
                <p className="a008-parameter-error">
                  The saved semantic model is not present in the current model
                  registry.
                </p>
              )}
              <p className="a008-parameter-footnote">
                Provider credentials only authorize the selected model. They
                never choose the semantic model.
              </p>
            </>
          )}
        </section>

        <section hidden={page !== "instructions"} aria-label="Global instructions">
          <div className="a008-parameter-group">
            <h3>
              <label htmlFor={`${id}-instructions`}>Persistent instructions</label>
            </h3>
            <p>
              Sent with every chat question. Survives reset, model changes and
              restart. Leave empty to disable.
            </p>
            <textarea
              id={`${id}-instructions`}
              rows={9}
              value={draft.instructions}
              placeholder="Du heter Agent 008, oavsett vilken modell eller leverantör som används."
              onChange={(event) =>
                edit({ ...draft, instructions: event.target.value })
              }
            />
          </div>
          <p className="a008-parameter-footnote">
            Use this for identity, language and enduring working instructions.
            Memory retrieval supplies relevant facts independently. These
            instructions do not configure knowledge extraction.
          </p>
        </section>

        <section hidden={page !== "budgets"} aria-label="Runtime budgets">
          <p className="a008-parameter-footnote">
            These limits control input, tool and memory processing. Chat output
            tokens are set under Model; semantic output is capped by both the
            semantic budget and the selected semantic model.
          </p>
          {fields.map((field) => (
            <div className="a008-parameter-group" key={field.key}>
              <h3>
                <label htmlFor={`${id}-${field.key}`}>{field.label}</label>{" "}
                <span className="a008-budget-unit">{field.unit}</span>
              </h3>
              <input
                id={`${id}-${field.key}`}
                type="number"
                min={field.minimum}
                max={field.maximum}
                step={1}
                required
                aria-describedby={`${id}-${field.key}-description`}
                value={
                  Number.isFinite(draft.budgets[field.key])
                    ? draft.budgets[field.key]
                    : ""
                }
                onChange={(event) =>
                  edit({
                    ...draft,
                    budgets: {
                      ...draft.budgets,
                      [field.key]: event.target.valueAsNumber,
                    },
                  })
                }
              />
              <p id={`${id}-${field.key}-description`}>{field.description}</p>
            </div>
          ))}
          <button
            type="button"
            className="a008-parameter-secondary"
            onClick={() =>
              edit({ ...draft, budgets: { ...saved.defaults.budgets } })
            }
          >
            Budget defaults
          </button>
        </section>
      </fieldset>
      {stale ? (
        <p role="status">
          Global settings changed elsewhere. Reload saved settings before saving.
        </p>
      ) : null}
      {dirty ? (
        <p className="a008-parameter-footnote">
          Unsaved changes in global settings.
        </p>
      ) : null}
      {error ? (
        <p className="a008-parameter-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="a008-parameter-notice" role="status">
          {notice}
        </p>
      ) : null}
      <p className="a008-parameter-footnote a008-settings-path">
        {saved.storagePath === null
          ? "Storage: temporary, this process only."
          : `Saved locally: ${saved.storagePath}`}
      </p>
    </form>
  );
}
