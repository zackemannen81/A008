import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.js";
import "./brand/a008.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("A008 GUI root element is missing.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
