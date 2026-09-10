import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.js";
import { applyAppTheme } from "./brand/theme.js";
import { readStoredAppTheme } from "./brand/theme-storage.js";
import "./brand/themes.css";
import "./brand/a008.css";
import "./brand/workspace.css";

applyAppTheme(readStoredAppTheme());

const root = document.getElementById("root");
if (root === null) {
  throw new Error("A008 GUI root element is missing.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
