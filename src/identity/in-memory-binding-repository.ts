import { IdentityError } from "./errors.js";
import { parseRuntimeId } from "./runtime-id.js";
import type {
  AcpIdentityBinding,
  AcpIdentityBindingRepository,
  AcpSessionId,
  ConversationId,
  ExternalIdentityReference,
  IdentityBindingRegistration,
} from "./types.js";

const EXTERNAL_NAMESPACE = /^[a-z][a-z0-9_-]{0,63}$/;
const EXTERNAL_VALUE_MAX_LENGTH = 512;

function normalizeExternalReference(
  reference: ExternalIdentityReference,
): ExternalIdentityReference {
  if (!EXTERNAL_NAMESPACE.test(reference.system)) {
    throw new IdentityError(
      "invalid_external_reference",
      "External identity system must be a canonical lowercase namespace.",
    );
  }
  if (!EXTERNAL_NAMESPACE.test(reference.kind)) {
    throw new IdentityError(
      "invalid_external_reference",
      "External identity kind must be a canonical lowercase namespace.",
    );
  }
  if (
    reference.value.length === 0 ||
    reference.value.length > EXTERNAL_VALUE_MAX_LENGTH ||
    reference.value !== reference.value.trim() ||
    /[\u0000-\u001f\u007f]/.test(reference.value)
  ) {
    throw new IdentityError(
      "invalid_external_reference",
      "External identity value must be non-empty, bounded, trimmed control-free text.",
    );
  }
  return { ...reference };
}

function externalKey(reference: ExternalIdentityReference): string {
  return JSON.stringify([reference.system, reference.kind, reference.value]);
}

function normalizeBinding(binding: AcpIdentityBinding): AcpIdentityBinding {
  const externalReferences = binding.externalReferences
    .map(normalizeExternalReference)
    .sort((left, right) => externalKey(left).localeCompare(externalKey(right)));
  const keys = externalReferences.map(externalKey);
  if (new Set(keys).size !== keys.length) {
    throw new IdentityError(
      "invalid_external_reference",
      "An ACP identity binding cannot contain duplicate external references.",
    );
  }

  return {
    projectId: parseRuntimeId(binding.projectId, "project"),
    conversationId: parseRuntimeId(binding.conversationId, "conversation"),
    taskId: parseRuntimeId(binding.taskId, "task"),
    agentId: parseRuntimeId(binding.agentId, "agent"),
    acpSessionId: parseRuntimeId(binding.acpSessionId, "acp_session"),
    externalReferences,
  };
}

function cloneBinding(binding: AcpIdentityBinding): AcpIdentityBinding {
  return {
    ...binding,
    externalReferences: binding.externalReferences.map((reference) => ({
      ...reference,
    })),
  };
}

function bindingsEqual(
  left: AcpIdentityBinding,
  right: AcpIdentityBinding,
): boolean {
  return (
    left.projectId === right.projectId &&
    left.conversationId === right.conversationId &&
    left.taskId === right.taskId &&
    left.agentId === right.agentId &&
    left.acpSessionId === right.acpSessionId &&
    left.externalReferences.length === right.externalReferences.length &&
    left.externalReferences.every(
      (reference, index) =>
        externalKey(reference) === externalKey(right.externalReferences[index]!),
    )
  );
}

export class InMemoryAcpIdentityBindingRepository
  implements AcpIdentityBindingRepository
{
  private bindingsBySession = new Map<string, AcpIdentityBinding>();
  private externalToSession = new Map<string, string>();
  private sessionsByConversation = new Map<string, Set<string>>();
  private transactionTail: Promise<void> = Promise.resolve();

  async register(
    unvalidatedBinding: AcpIdentityBinding,
  ): Promise<IdentityBindingRegistration> {
    const binding = normalizeBinding(unvalidatedBinding);
    const previous = this.transactionTail;
    let release: () => void = () => undefined;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      const workingBindings = new Map(
        [...this.bindingsBySession].map(([id, value]) => [id, cloneBinding(value)]),
      );
      const workingExternal = new Map(this.externalToSession);
      const workingConversations = new Map(
        [...this.sessionsByConversation].map(([id, sessions]) => [
          id,
          new Set(sessions),
        ]),
      );

      const existing = workingBindings.get(binding.acpSessionId);
      if (existing !== undefined) {
        if (bindingsEqual(existing, binding)) {
          return "existing";
        }
        throw new IdentityError(
          "identity_conflict",
          `ACP session is already bound: ${binding.acpSessionId}`,
        );
      }

      const conversationSessions =
        workingConversations.get(binding.conversationId) ?? new Set<string>();
      for (const sessionId of conversationSessions) {
        const related = workingBindings.get(sessionId)!;
        if (
          related.projectId !== binding.projectId ||
          related.agentId !== binding.agentId
        ) {
          throw new IdentityError(
            "identity_conflict",
            "Conversation bindings must retain the same project and agent IDs.",
          );
        }
      }

      for (const reference of binding.externalReferences) {
        const key = externalKey(reference);
        if (workingExternal.has(key)) {
          throw new IdentityError(
            "identity_conflict",
            "External identity reference is already bound to another ACP session.",
          );
        }
        workingExternal.set(key, binding.acpSessionId);
      }

      workingBindings.set(binding.acpSessionId, cloneBinding(binding));
      conversationSessions.add(binding.acpSessionId);
      workingConversations.set(binding.conversationId, conversationSessions);

      this.bindingsBySession = workingBindings;
      this.externalToSession = workingExternal;
      this.sessionsByConversation = workingConversations;
      return "created";
    } finally {
      release();
    }
  }

  async resolveAcpSession(
    acpSessionId: AcpSessionId,
  ): Promise<AcpIdentityBinding | undefined> {
    const normalized = parseRuntimeId(acpSessionId, "acp_session");
    await this.transactionTail;
    const binding = this.bindingsBySession.get(normalized);
    return binding === undefined ? undefined : cloneBinding(binding);
  }

  async resolveExternal(
    unvalidatedReference: ExternalIdentityReference,
  ): Promise<AcpIdentityBinding | undefined> {
    const reference = normalizeExternalReference(unvalidatedReference);
    await this.transactionTail;
    const sessionId = this.externalToSession.get(externalKey(reference));
    const binding =
      sessionId === undefined
        ? undefined
        : this.bindingsBySession.get(sessionId);
    return binding === undefined ? undefined : cloneBinding(binding);
  }

  async listConversation(
    conversationId: ConversationId,
  ): Promise<readonly AcpIdentityBinding[]> {
    const normalized = parseRuntimeId(conversationId, "conversation");
    await this.transactionTail;
    const sessions = this.sessionsByConversation.get(normalized) ?? new Set();
    return [...sessions]
      .sort((left, right) => left.localeCompare(right))
      .map((sessionId) => cloneBinding(this.bindingsBySession.get(sessionId)!));
  }
}
