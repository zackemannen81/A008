import type { SessionControl, SessionSnapshot } from "./session-controls.js";
export const DEFAULT_GUI_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";

export type GuiSessionStatus = "idle" | "connecting" | "ready" | "error";

export interface GuiSessionState {
  readonly permission?: { id: string; title: string; text: string } | undefined;
  readonly tools?: readonly { id: string; title: string; status: string; text: string }[];
  /** Absent only for a pre-ADR-0026 host. */
  readonly details?: SessionSnapshot;
  readonly busy?: boolean;
  readonly pendingText?: string;
  readonly status: GuiSessionStatus;
  readonly sessionId: string | undefined;
  readonly model: string;
  readonly thought: string;
  readonly answer: string;
  readonly error: string | undefined;
}

export type ToolPermissionDecision = "reject" | "allow_once" | "allow_all";

export interface GuiSession extends GuiSessionState {
  resolveToolPermission?(decision: ToolPermissionDecision): void;
  controlSession?(control: SessionControl): Promise<SessionSnapshot>;
  endSession?(): Promise<void>;
  connect(): Promise<void>;
  prompt(text: string): Promise<void>;
  cancel(): Promise<void>;
}

export interface GuiWebSocketEvent {
  readonly data?: unknown;
}

export interface GuiWebSocket {
  readonly readyState: number;
  readonly url: string;
  send(data: string): void;
  close(): void;
  addEventListener(
    type: "open" | "message" | "error" | "close",
    listener: (event: GuiWebSocketEvent) => void,
  ): void;
  removeEventListener(
    type: "open" | "message" | "error" | "close",
    listener: (event: GuiWebSocketEvent) => void,
  ): void;
}

export type GuiWebSocketConstructor = new (url: string) => GuiWebSocket;

export interface GuiSessionClientOptions {
  readonly url?: string;
  readonly model?: string;
  readonly webSocket?: GuiWebSocketConstructor;
  readonly createRequestId?: () => string;
  /** Test/embedding override; production defaults to 0.5s, 1s, 2s, then 5s capped. */
  readonly reconnectDelaysMs?: readonly number[];
}
