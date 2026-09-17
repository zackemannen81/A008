import {
  CREDENTIAL_STATUS_LABEL,
  MEMORY_STATUS_LABEL,
  PRODUCT_NAME,
  TELEMETRY_STATUS_LABEL,
} from "../brand/identity.js";
import type { GuiSession } from "../session/types.js";
import { redactSecrets } from "./secret-safe.js";

export interface SettingsField {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

export interface SettingsView {
  readonly product: string;
  readonly model: string;
  readonly connection: string;
  readonly connectionKind: GuiSession["status"];
  readonly session: string;
  readonly memory: string;
  readonly telemetry: string;
  readonly credentials: string;
  readonly error: string | undefined;
  readonly fields: readonly SettingsField[];
  readonly canConnect: boolean;
}

const CONNECTION_LABEL: Record<GuiSession["status"], string> = {
  idle: "idle",
  connecting: "connecting",
  ready: "connected",
  error: "error",
};

export function connectionLabel(status: GuiSession["status"]): string {
  return CONNECTION_LABEL[status];
}

export function buildSettingsView(session: GuiSession): SettingsView {
  const model = session.model.trim();
  const sessionId = session.sessionId?.trim();
  const rawError = session.error?.trim();
  const error =
    rawError === undefined || rawError.length === 0
      ? undefined
      : redactSecrets(rawError);

  const product = PRODUCT_NAME;
  const connection = connectionLabel(session.status);
  const memory = MEMORY_STATUS_LABEL;
  const telemetry = TELEMETRY_STATUS_LABEL;
  const credentials = CREDENTIAL_STATUS_LABEL;
  const displayedSession =
    sessionId === undefined || sessionId.length === 0 ? "none" : sessionId;
  const displayedModel = model.length === 0 ? "unset" : model;

  return {
    product,
    model: displayedModel,
    connection,
    connectionKind: session.status,
    session: displayedSession,
    memory,
    telemetry,
    credentials,
    error,
    fields: [
      { id: "product", label: "Product", value: product },
      { id: "model", label: "Model", value: displayedModel },
      { id: "connection", label: "Connection", value: connection },
      { id: "session", label: "Session", value: displayedSession },
      ...(session.details
        ? [
            {
              id: "cwd",
              label: "Working directory",
              value: session.details.runtime.cwd,
            },
          ]
        : []),
      { id: "memory", label: "Memory", value: memory },
      { id: "telemetry", label: "Telemetry", value: telemetry },
      { id: "credentials", label: "Credentials", value: credentials },
    ],
    canConnect: session.status === "idle" || session.status === "error",
  };
}
