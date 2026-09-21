import type {
  PromptImageAttachment,
  SessionControl,
  SessionSnapshot,
} from "@a008/protocol";
export type {
  PromptImageAttachment,
  SessionControl,
  SessionSnapshot,
} from "@a008/protocol";
import type { CredentialAdapter } from "./credentials.js";
import type { ClientLocation } from "./origin.js";
export const DEFAULT_GUI_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";

export type GuiSessionStatus = "idle" | "connecting" | "ready" | "error";

export type RuntimeToolStatus =
  "running" | "ok" | "failed" | "completed" | "pending";

export interface RuntimeToolCall {
  readonly id: string;
  readonly tool?: string;
  readonly status: RuntimeToolStatus | string;
  readonly startedAt?: number;
  readonly finishedAt?: number;
  readonly retryOf?: string;
  readonly recoveredBy?: string;
  readonly argsSummary?: string;
  readonly errorSummary?: string;
  readonly title?: string;
  readonly text?: string;
}

export interface GuiSessionState {
  readonly permission?: { id: string; title: string; text: string } | undefined;
  readonly tools?: readonly RuntimeToolCall[] | undefined;
  /** Absent only for a pre-ADR-0026 host. */
  readonly details?: SessionSnapshot | undefined;
  readonly busy?: boolean | undefined;
  readonly pendingText?: string | undefined;
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
  prompt(text: string, attachment?: PromptImageAttachment): Promise<void>;
  generateImage?(prompt: string): Promise<void>;
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

export type GuiWebSocketConstructor = new (
  url: string,
  protocols?: string | readonly string[],
) => GuiWebSocket;

export interface GuiSessionClientOptions {
  readonly url?: string;
  readonly model?: string;
  readonly webSocket?: GuiWebSocketConstructor;
  readonly createRequestId?: () => string;
  readonly credentials?: CredentialAdapter;
  readonly location?: ClientLocation;
  /** Test/embedding override; production defaults to 0.5s, 1s, 2s, then 5s capped. */
  readonly reconnectDelaysMs?: readonly number[];
}
