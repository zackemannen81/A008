export interface GuiSession {
  readonly status: "idle" | "connecting" | "ready" | "error";
  readonly sessionId: string | undefined;
  readonly model: string;
  readonly thought: string;
  readonly answer: string;
  readonly error: string | undefined;
  connect(): Promise<void>;
  prompt(text: string): Promise<void>;
  cancel(): Promise<void>;
}
