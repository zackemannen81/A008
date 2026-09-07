import { useId, useState, type FormEvent } from "react";
import type { GuiSession } from "../session/types.js";
import { controlSession } from "../composer/submit.js";
import type { RuntimePreferences, RuntimePreferencesSnapshot } from "./runtime-preferences.js";

const copy = (s: RuntimePreferences): RuntimePreferences => ({ instructions: s.instructions, budgets: { ...s.budgets } });

export function GlobalSettingsForm({ session, initial, page }: {
  session: GuiSession;
  initial: RuntimePreferencesSnapshot;
  page: "model" | "budgets" | "instructions";
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

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const state = await controlSession(session, { action: "configureRuntime", settings: draft, revision: saved.revision });
      if (!state.runtimePreferences) throw new Error("Host did not return saved global settings.");
      setSaved(state.runtimePreferences);
      setDraft(copy(state.runtimePreferences.settings));
      setNotice(state.runtimePreferences.storagePath === null
        ? "Applied for this host process. Persistence is disabled."
        : "Saved for all A008 projects and models. Applies to the next chat message, including after restart.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save global settings."); }
    finally { setSaving(false); }
  }
  async function reload() {
    setSaving(true); setError(""); setNotice("");
    try {
      const state = await controlSession(session, { action: "inspect" });
      if (!state.runtimePreferences) throw new Error("Global settings are unavailable on this host.");
      setSaved(state.runtimePreferences); setDraft(copy(state.runtimePreferences.settings));
      setNotice("Loaded saved global settings.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not reload settings."); }
    finally { setSaving(false); }
  }
  function edit(next: RuntimePreferences) { setDraft(next); setNotice(""); setError(""); }

  return <form className="a008-parameter-form" hidden={page === "model"} onSubmit={event => { void save(event); }}>
    <p className="a008-global-scope">GLOBAL · ALL PROJECTS & MODELS</p>
    <fieldset disabled={disabled}>
      <div className="a008-global-actions">
        <button type="submit" disabled={!dirty || stale}>{saving ? "Saving…" : "Save global settings"}</button>
        <button type="button" className="a008-parameter-secondary" onClick={() => { void reload(); }}>Reload saved settings</button>
      </div>
      <section hidden={page !== "instructions"} aria-label="Global instructions">
        <div className="a008-parameter-group">
          <h3><label htmlFor={`${id}-instructions`}>Persistent instructions</label></h3>
          <p>Sent with every chat question. Survives reset, model changes and restart. Leave empty to disable.</p>
          <textarea id={`${id}-instructions`} rows={9} value={draft.instructions}
            placeholder="Du heter Agent 008, oavsett vilken modell eller leverantör som används."
            onChange={event => edit({ ...draft, instructions: event.target.value })} />
        </div>
        <p className="a008-parameter-footnote">Use this for identity, language and enduring working instructions. Memory retrieval supplies relevant facts independently. These instructions do not configure knowledge extraction.</p>
      </section>
      <section hidden={page !== "budgets"} aria-label="Runtime budgets">
        <p className="a008-parameter-footnote">These limits control input and memory processing. Model output tokens are set under Model. Each request keeps the settings it started with.</p>
        {fields.map(field => <div className="a008-parameter-group" key={field.key}>
          <h3><label htmlFor={`${id}-${field.key}`}>{field.label}</label> <span className="a008-budget-unit">{field.unit}</span></h3>
          <input id={`${id}-${field.key}`} type="number" min={field.minimum} max={field.maximum} step={1} required
            aria-describedby={`${id}-${field.key}-description`}
            value={Number.isFinite(draft.budgets[field.key]) ? draft.budgets[field.key] : ""}
            onChange={event => edit({ ...draft, budgets: { ...draft.budgets, [field.key]: event.target.valueAsNumber } })} />
          <p id={`${id}-${field.key}-description`}>{field.description}</p>
        </div>)}
        <button type="button" className="a008-parameter-secondary" onClick={() => edit({ ...draft, budgets: { ...saved.defaults.budgets } })}>Budget defaults</button>
      </section>
    </fieldset>
    {stale ? <p role="status">Global settings changed elsewhere. Reload saved settings before saving.</p> : null}
    {dirty ? <p className="a008-parameter-footnote">Unsaved changes in global settings.</p> : null}
    {error ? <p className="a008-parameter-error" role="alert">{error}</p> : null}
    {notice ? <p className="a008-parameter-notice" role="status">{notice}</p> : null}
    <p className="a008-parameter-footnote a008-settings-path">{saved.storagePath === null ? "Storage: temporary, this process only." : `Saved locally: ${saved.storagePath}`}</p>
  </form>;
}
