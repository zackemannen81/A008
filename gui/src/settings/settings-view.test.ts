import type { GuiSession } from "../session/types.js";
import { buildSettingsView } from "./settings-view.js";
import { redactSecrets } from "./secret-safe.js";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function session(overrides: Partial<GuiSession> = {}): GuiSession {
  return {
    status: "idle",
    sessionId: undefined,
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    thought: "",
    answer: "",
    error: undefined,
    async connect() {},
    async prompt() {},
    async cancel() {},
    ...overrides,
  };
}

function joined(view: ReturnType<typeof buildSettingsView>): string {
  return [
    ...view.fields.map((field) => `${field.label}:${field.value}`),
    view.error ?? "",
  ].join("\n");
}

export function runSettingsViewChecks(): void {
  const idle = buildSettingsView(session());
  assert(idle.product === "A008", "product is A008");
  assert(idle.model === "nvidia/nemotron-3.5-lightning-30b-a3b", "model from session");
  assert(idle.connection === "idle", "idle connection label");
  assert(idle.session === "none", "missing session id is none");
  assert(idle.memory === "local, host-owned", "memory has no path");
  assert(idle.telemetry === "off", "telemetry is off");
  assert(idle.credentials === "host process only", "credentials stay on the host");
  assert(idle.canConnect, "idle can connect");
  assert(idle.error === undefined, "idle has no error");

  const ready = buildSettingsView(
    session({
      status: "ready",
      sessionId: "A008_v1_acp_session_11111111-1111-4111-8111-111111111111",
    }),
  );
  assert(ready.connection === "connected", "ready maps to connected");
  assert(!ready.canConnect, "ready does not offer connect");
  assert(
    ready.session === "A008_v1_acp_session_11111111-1111-4111-8111-111111111111",
    "session id is displayed",
  );

  const leaked = buildSettingsView(
    session({
      status: "error",
      error:
        "missing NVIDIA_API_KEY authorization Bearer nvapi-secret sk-secret C:\\Users\\example\\.A008\\memory.sqlite",
    }),
  );
  assert(leaked.canConnect, "error can reconnect");
  assert(leaked.error !== undefined, "error is shown");
  const shown = joined(leaked).toLowerCase();
  assert(!shown.includes("nvidia_api_key"), "API key name is not shown");
  assert(!shown.includes("bearer nvapi"), "bearer token is not shown");
  assert(!shown.includes("sk-secret"), "sk token is not shown");
  assert(!shown.includes("example"), "home path is not shown");
  assert(!shown.includes("memory.sqlite"), "sqlite path is not shown");
  assert(!shown.includes("openhands"), "OpenHands is not product copy");
  assert(!shown.includes("posthog"), "PostHog is not product copy");
  assert(!shown.includes("agent canvas"), "Agent Canvas is not product copy");

  assert(redactSecrets("NVIDIA_API_KEY") === "[redacted]", "key-only error redacts");
  assert(
    !redactSecrets("see .env.local").includes(".env"),
    "env file names are redacted",
  );
}

runSettingsViewChecks();
