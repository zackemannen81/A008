import {
  v2CommandReceiptSchema,
  v2ErrorSchema,
  v2InfoSchema,
  v2TicketResponseSchema,
  type V2CommandReceipt,
  type V2Info,
} from "@a008/protocol";
type V2TicketResponse = {
  readonly ticket: string;
  readonly projectId: string;
  readonly serverInstanceId: string;
  readonly expiresAt: number;
  readonly sessionId?: string | undefined;
};
import { readErrorMessage, requestJson, type HttpClientOptions } from "./http.js";

export class V2ClientError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "V2ClientError";
    this.code = code;
    this.retryable = retryable;
  }
}

function throwV2(body: unknown, fallback: string, status: number): never {
  const parsed = v2ErrorSchema.safeParse(body);
  if (parsed.success) {
    throw new V2ClientError(
      parsed.data.code,
      parsed.data.message,
      parsed.data.retryable,
    );
  }
  throw new V2ClientError(
    "RUNTIME_FAILED",
    fallback,
    status >= 500,
  );
}

export async function loadV2Info(client: HttpClientOptions): Promise<V2Info> {
  const { response, body } = await requestJson(client, "/v2/info");
  if (!response.ok)
    throwV2(body, await readErrorMessage(response, "V2 discovery failed"), response.status);
  const parsed = v2InfoSchema.safeParse(body);
  if (!parsed.success)
    throw new V2ClientError("RUNTIME_FAILED", "V2 discovery metadata is incompatible.");
  return parsed.data;
}

export async function issueV2Ticket(
  client: HttpClientOptions,
  projectId: string,
  sessionId?: string,
): Promise<V2TicketResponse> {
  const { response, body } = await requestJson(client, "/v2/auth/ticket", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectId,
      ...(sessionId === undefined ? {} : { sessionId }),
    }),
  });
  if (!response.ok)
    throwV2(body, await readErrorMessage(response, "V2 ticket failed"), response.status);
  const parsed = v2TicketResponseSchema.safeParse(body);
  if (!parsed.success)
    throw new V2ClientError("RUNTIME_FAILED", "V2 ticket response is incompatible.");
  return parsed.data;
}

export async function lookupV2CommandReceipt(
  client: HttpClientOptions,
  projectId: string,
  commandId: string,
): Promise<V2CommandReceipt> {
  const { response, body } = await requestJson(
    client,
    `/v2/projects/${encodeURIComponent(projectId)}/commands/${encodeURIComponent(commandId)}`,
  );
  if (!response.ok)
    throwV2(
      body,
      await readErrorMessage(response, "Command receipt lookup failed"),
      response.status,
    );
  const parsed = v2CommandReceiptSchema.safeParse(body);
  if (!parsed.success)
    throw new V2ClientError("RUNTIME_FAILED", "Command receipt is incompatible.");
  return parsed.data;
}
