import type { GuiSession } from "../session/types.js";
import { buildSettingsView } from "./settings-view.js";

/** A008-0037 settings/status pane. Keep the SettingsPane export. */
export function SettingsPane(props: { readonly session: GuiSession }) {
  const view = buildSettingsView(props.session);

  return (
    <section className="a008-settings" aria-label="A008 settings">
      <h2 className="a008-settings-title">Settings</h2>
      <dl className="a008-settings-list">
        {view.fields.map((field) => (
          <div
            key={field.id}
            className="a008-settings-row"
            data-field={field.id}
          >
            <dt>{field.label}</dt>
            <dd>
              {field.id === "connection" ? (
                <span
                  className={`a008-connection a008-connection-${view.connectionKind}`}
                >
                  <span className="a008-connection-dot" aria-hidden="true" />
                  {field.value}
                </span>
              ) : (
                field.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {view.error !== undefined ? (
        <p className="a008-settings-error" role="status">
          {view.error}
        </p>
      ) : null}
      {view.canConnect ? (
        <button
          type="button"
          className="a008-settings-connect"
          onClick={() => {
            void props.session.connect();
          }}
        >
          Connect
        </button>
      ) : null}
    </section>
  );
}
