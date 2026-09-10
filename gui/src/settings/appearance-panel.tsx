import { useState } from "react";
import { APP_THEMES, type AppThemeId } from "../brand/theme.js";
import { readStoredAppTheme, selectAppTheme } from "../brand/theme-storage.js";

export function AppearancePanel() {
  const [theme, setTheme] = useState<AppThemeId>(() => readStoredAppTheme());
  return (
    <section className="a008-appearance" aria-label="Appearance">
      <h3>App theme</h3>
      <p className="a008-parameter-footnote">
        Changes the visual surfaces of this client. It does not change the
        model, conversation, memory or tools.
      </p>
      <div className="a008-theme-choices" role="group" aria-label="App theme">
        {APP_THEMES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="a008-theme-card"
            data-a008-theme={item.id}
            aria-pressed={theme === item.id}
            onClick={() => setTheme(selectAppTheme(item.id))}
          >
            <strong>{item.name}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
