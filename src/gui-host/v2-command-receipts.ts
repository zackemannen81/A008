import { createHash } from "node:crypto";
import type {
  V2CommandReceipt,
  V2ErrorCode,
  V2SessionCommand,
} from "../../packages/protocol/src/index.js";
import { V2AuthError } from "./v2-auth.js";

export const V2_COMMAND_RECEIPT_RETENTION_MS = 5 * 60_000;
export const V2_COMMAND_RECEIPT_LIMIT_PER_PRINCIPAL = 1_024;

interface StoredReceipt {
  readonly principalId: string;
  readonly digest: string;
  receipt: V2CommandReceipt;
}

export type V2CommandBegin =
  | { readonly kind: "new"; readonly receipt: V2CommandReceipt }
  | { readonly kind: "existing"; readonly receipt: V2CommandReceipt };

export class V2CommandReceiptStore {
  readonly #serverInstanceId: string;
  readonly #now: () => number;
  readonly #retentionMs: number;
  readonly #limitPerPrincipal: number;
  readonly #entries = new Map<string, StoredReceipt>();

  constructor(options: {
    serverInstanceId: string;
    now?: () => number;
    retentionMs?: number;
    limitPerPrincipal?: number;
  }) {
    this.#serverInstanceId = options.serverInstanceId;
    this.#now = options.now ?? Date.now;
    this.#retentionMs = options.retentionMs ?? V2_COMMAND_RECEIPT_RETENTION_MS;
    this.#limitPerPrincipal =
      options.limitPerPrincipal ?? V2_COMMAND_RECEIPT_LIMIT_PER_PRINCIPAL;
  }

  begin(principalId: string, command: V2SessionCommand): V2CommandBegin {
    const commandId = mutationCommandId(command);
    const digest = canonicalCommandDigest(command);
    this.#purgeExpired(principalId);

    const key = receiptKey(principalId, commandId);
    const existing = this.#entries.get(key);
    if (existing) {
      if (existing.digest !== digest)
        throw new V2AuthError(
          "COMMAND_CONFLICT",
          409,
          "The command ID is already bound to different content.",
        );
      return { kind: "existing", receipt: cloneReceipt(existing.receipt) };
    }

    const count = [...this.#entries.values()].filter(
      (entry) => entry.principalId === principalId,
    ).length;
    if (count >= this.#limitPerPrincipal)
      throw new V2AuthError(
        "CAPACITY_EXCEEDED",
        429,
        "The command receipt capacity for this principal is exhausted.",
      );

    const receipt: V2CommandReceipt = {
      serverInstanceId: this.#serverInstanceId,
      commandId,
      action: command.action,
      projectId: command.projectId,
      ...("sessionId" in command ? { sessionId: command.sessionId } : {}),
      status: "running",
      startedAt: this.#now(),
    };
    this.#entries.set(key, { principalId, digest, receipt });
    return { kind: "new", receipt: cloneReceipt(receipt) };
  }

  noteSession(
    principalId: string,
    commandId: string,
    sessionId: string,
  ): V2CommandReceipt {
    const stored = this.#require(principalId, commandId);
    stored.receipt = { ...stored.receipt, sessionId };
    return cloneReceipt(stored.receipt);
  }

  noteTurn(
    principalId: string,
    commandId: string,
    turnId: string,
  ): V2CommandReceipt {
    const stored = this.#require(principalId, commandId);
    stored.receipt = { ...stored.receipt, turnId };
    return cloneReceipt(stored.receipt);
  }

  succeed(
    principalId: string,
    commandId: string,
    details: { sessionId?: string; turnId?: string } = {},
  ): V2CommandReceipt {
    const stored = this.#require(principalId, commandId);
    const now = this.#now();
    stored.receipt = {
      ...stored.receipt,
      ...details,
      status: "succeeded",
      settledAt: now,
      error: undefined,
    };
    return cloneReceipt(stored.receipt);
  }

  fail(
    principalId: string,
    commandId: string,
    failure: {
      code: V2ErrorCode;
      message: string;
      retryable: boolean;
      sessionId?: string;
      turnId?: string;
    },
  ): V2CommandReceipt {
    const stored = this.#require(principalId, commandId);
    const now = this.#now();
    stored.receipt = {
      ...stored.receipt,
      ...(failure.sessionId ? { sessionId: failure.sessionId } : {}),
      ...(failure.turnId ? { turnId: failure.turnId } : {}),
      status: "failed",
      settledAt: now,
      error: {
        code: failure.code,
        message: failure.message,
        retryable: failure.retryable,
      },
    };
    return cloneReceipt(stored.receipt);
  }

  lookup(
    principalId: string,
    projectId: string,
    commandId: string,
  ): V2CommandReceipt {
    this.#purgeExpired(principalId);
    const stored = this.#entries.get(receiptKey(principalId, commandId));
    if (!stored || stored.receipt.projectId !== projectId)
      throw new V2AuthError(
        "COMMAND_UNKNOWN",
        404,
        "The command receipt is unknown or expired.",
      );
    return cloneReceipt(stored.receipt);
  }

  #require(principalId: string, commandId: string): StoredReceipt {
    const stored = this.#entries.get(receiptKey(principalId, commandId));
    if (!stored)
      throw new V2AuthError(
        "COMMAND_UNKNOWN",
        404,
        "The command receipt is unknown or expired.",
      );
    return stored;
  }

  #purgeExpired(principalId: string): void {
    const now = this.#now();
    for (const [key, stored] of this.#entries) {
      if (stored.principalId !== principalId) continue;
      const settledAt = stored.receipt.settledAt;
      if (
        stored.receipt.status !== "running" &&
        settledAt !== undefined &&
        settledAt + this.#retentionMs <= now
      )
        this.#entries.delete(key);
    }
  }
}

export function isV2MutationCommand(command: V2SessionCommand): boolean {
  return (
    command.action !== "session/inspect" &&
    !(
      command.action === "session/control" &&
      command.payload.control.action === "inspect"
    )
  );
}

export function isV2ReceiptCommand(command: V2SessionCommand): boolean {
  return isV2MutationCommand(command) && command.action !== "session/resume";
}

export function mutationCommandId(command: V2SessionCommand): string {
  if (!isV2MutationCommand(command))
    throw new V2AuthError(
      "INVALID_REQUEST",
      400,
      "Read-only commands do not require a command ID.",
    );
  if (!("commandId" in command) || !command.commandId)
    throw new V2AuthError(
      "INVALID_REQUEST",
      400,
      "Mutating V2 commands require commandId.",
    );
  return command.commandId;
}

export function canonicalCommandDigest(command: V2SessionCommand): string {
  const canonical = canonicalJson({
    action: command.action,
    projectId: command.projectId,
    ...("sessionId" in command ? { sessionId: command.sessionId } : {}),
    ...("payload" in command && command.payload !== undefined
      ? { payload: command.payload }
      : {}),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function receiptKey(principalId: string, commandId: string): string {
  return `${principalId}\u0000${commandId}`;
}

function cloneReceipt(receipt: V2CommandReceipt): V2CommandReceipt {
  return {
    ...receipt,
    ...(receipt.error ? { error: { ...receipt.error } } : {}),
  };
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  }
  return value;
}
