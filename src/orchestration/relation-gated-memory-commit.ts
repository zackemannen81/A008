import { parseRuntimeId } from "../identity/runtime-id.js";
import type { ProjectId } from "../identity/types.js";
import { MemoryError } from "../memory/errors.js";
import type {
  RetrievalDocument,
} from "../memory/retrieval-types.js";
import type {
  KnowledgeProposal,
  ReconciliationDecision,
  ReconciliationGuard,
  ReconciliationResult,
} from "../memory/types.js";
import {
  serializeStagedKnowledgeProposals,
  type KnowledgeIntakeMeasurer,
  type StagedKnowledgeBatch,
  type StagedKnowledgeProposal,
} from "./post-output-knowledge-intake.js";
import type {
  RelationCandidate,
  RelationCandidateSource,
} from "./relation-candidate-source.js";
import type { SemanticOperationContext } from "./semantic-operation.js";

export interface RelationClassifierProposal {
  readonly proposition: string;
  readonly kind: string;
  readonly tags: readonly string[];
  readonly scope: readonly string[];
  readonly domains: readonly string[];
  readonly entities: readonly string[];
  readonly confidence: number;
}

export interface RelationClassifierCandidate {
  readonly handle: string;
  readonly proposition: string;
  readonly kind: string;
  readonly tags: readonly string[];
  readonly scope: readonly string[];
  readonly authority: number;
  readonly confidence: number;
  readonly activationStatus: "active" | "dormant";
}

export interface SemanticAssociationDecision {
  readonly fromHandle: string;
  readonly toHandle: string;
  readonly relation: string;
  readonly supportsRelation: boolean;
  readonly support: { readonly source: "message" | "source"; readonly start: number; readonly end: number };
}
export interface AssociationClassifierContext {
  readonly source: { readonly origin: "message" | "source"; readonly content: string };
  readonly entities: readonly { readonly handle: string; readonly labels: readonly string[]; readonly type: string }[];
  readonly existing: readonly { readonly fromHandle: string; readonly toHandle: string; readonly relation: string; readonly scope: readonly string[] }[];
}
export interface RelationClassifierInput {
  readonly associationContext?: AssociationClassifierContext;
  readonly sourceSupport?: { readonly origin: "message" | "source"; readonly content: string; readonly start: number; readonly end: number };
  readonly proposal: RelationClassifierProposal;
  readonly candidates: readonly RelationClassifierCandidate[];
}

export type RelationClassifierDecision = { readonly associations?: readonly SemanticAssociationDecision[] } & (
  | { readonly type: "new" }
  | {
      readonly type: "restatement" | "extend" | "supersede";
      readonly targetHandle: string;
      readonly supportsTarget?: boolean;
    }
  | {
      readonly type: "conflict";
      readonly targetHandles: readonly string[];
    });

export interface KnowledgeRelationClassifier {
  classify(
    input: RelationClassifierInput,
    context?: SemanticOperationContext,
  ): Promise<RelationClassifierDecision>;
}

export interface RelationClassifierBudget {
  readonly maximum: number;
  readonly measurer: KnowledgeIntakeMeasurer;
}

export interface RelationMemoryPort {
  readonly projectId: ProjectId | undefined;
  reconcile(
    proposal: KnowledgeProposal,
    decision: ReconciliationDecision,
    guard?: ReconciliationGuard,
  ): Promise<ReconciliationResult>;
}

export interface RelationIndexWriter {
  readonly projectId: ProjectId;
  upsertRetrievalDocument(document: RetrievalDocument): Promise<void>;
}

export interface RelationGatedMemoryCommitOptions {
  readonly memory: RelationMemoryPort;
  readonly candidateSource: RelationCandidateSource;
  readonly classifier: KnowledgeRelationClassifier;
  readonly classifierBudget: RelationClassifierBudget;
  readonly indexWriter: RelationIndexWriter;
  readonly maximumClassifierCandidates?: number;
  readonly activateNewProposal?: (
    sourceMessage: string,
    proposal: KnowledgeProposal,
  ) => KnowledgeProposal;
}

export interface RelationCommitInput {
  readonly batch: StagedKnowledgeBatch;
  readonly proposalIndex: number;
}

export interface RelationCommitEvidence {
  readonly reinforcement?: string;
  readonly associations?: readonly string[];
  readonly materializedCandidateIds: readonly string[];
  readonly classifierCandidateIds: readonly string[];
  readonly classifierInputSerialized: string;
  readonly classifierInputMeasuredUnits: number;
  readonly classifierInputMeasurementUnit: string;
}

export interface UpdatedRelationIndex {
  readonly status: "updated";
  readonly document: RetrievalDocument;
}

export interface NotRequiredRelationIndex {
  readonly status: "not_required";
}

export interface PendingRelationIndexRepair {
  readonly status: "pending_repair";
  readonly document: RetrievalDocument;
  readonly error: unknown;
}

export type RelationIndexResult =
  | UpdatedRelationIndex
  | NotRequiredRelationIndex
  | PendingRelationIndexRepair;

export interface RelationGatedCommitResult {
  readonly classifierDecision: RelationClassifierDecision;
  readonly reconciliationDecision: ReconciliationDecision;
  readonly reconciliation: ReconciliationResult;
  readonly evidence: RelationCommitEvidence;
  readonly index: RelationIndexResult;
}

function positiveSafeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new MemoryError(
      "invalid_input",
      `${field} must be a positive safe integer`,
    );
  }
  return value;
}

function nonNegativeSafeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MemoryError(
      "invalid_input",
      `${field} must be a non-negative safe integer`,
    );
  }
  return value;
}

function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MemoryError("invalid_input", `${field} must be a non-empty string`);
  }
  return value.trim();
}

function unit(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new MemoryError(
      "invalid_input",
      `${field} must be a finite number between 0 and 1`,
    );
  }
  return value;
}

function normalizedStrings(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new MemoryError("invalid_input", `${field} must be an array`);
  }
  const normalized = value.map((entry, index) =>
    nonEmpty(entry, `${field} ${index + 1}`),
  );
  const unique = [...new Set(normalized)].sort((left, right) =>
    left.localeCompare(right),
  );
  if (
    unique.length !== normalized.length ||
    unique.some((entry, index) => entry !== normalized[index])
  ) {
    throw new MemoryError(
      "invalid_input",
      `${field} must already be unique and sorted`,
    );
  }
  return unique;
}

function validatedStagedProposal(
  staged: StagedKnowledgeProposal,
): StagedKnowledgeProposal {
  const proposal = staged.proposal as unknown as Record<string, unknown>;
  const relevanceScore = unit(proposal.relevanceScore, "proposal relevanceScore");
  const activationThreshold = unit(
    proposal.activationThreshold,
    "proposal activationThreshold",
  );
  if (relevanceScore !== 0 || activationThreshold === 0) {
    throw new MemoryError(
      "invalid_input",
      "staged proposal must remain dormant with zero relevance and a positive threshold",
    );
  }
  if (proposal.keepAlive !== false || proposal.sourceBacked !== false) {
    throw new MemoryError(
      "invalid_input",
      "staged proposal cannot set keepAlive or sourceBacked",
    );
  }
  if (!Array.isArray(proposal.provenance) || proposal.provenance.length !== 0) {
    throw new MemoryError(
      "invalid_input",
      "staged proposal provenance must be empty",
    );
  }
  return {
    proposal: {
      proposition: nonEmpty(proposal.proposition, "proposal proposition"),
      kind: nonEmpty(proposal.kind, "proposal kind"),
      tags: normalizedStrings(proposal.tags, "proposal tags"),
      scope: normalizedStrings(proposal.scope, "proposal scope"),
      relevanceScore,
      activationThreshold,
      keepAlive: false,
      authority: unit(proposal.authority, "proposal authority"),
      confidence: unit(proposal.confidence, "proposal confidence"),
      sourceBacked: false,
      provenance: [],
    },
    domains: normalizedStrings(staged.domains, "proposal domains"),
    entities: normalizedStrings(staged.entities, "proposal entities"),
  };
}

function copyDocument(document: RetrievalDocument): RetrievalDocument {
  return {
    knowledgeId: document.knowledgeId,
    ...(document.entities === undefined
      ? {}
      : { entities: [...document.entities] }),
    ...(document.domains === undefined
      ? {}
      : { domains: [...document.domains] }),
    ...(document.embedding === undefined
      ? {}
      : { embedding: [...document.embedding] }),
    ...(document.embeddingModel === undefined
      ? {}
      : { embeddingModel: document.embeddingModel }),
  };
}

function classifierProposal(
  staged: StagedKnowledgeProposal,
): RelationClassifierProposal {
  return {
    proposition: staged.proposal.proposition,
    kind: staged.proposal.kind,
    tags: [...(staged.proposal.tags ?? [])],
    scope: [...staged.proposal.scope],
    domains: [...staged.domains],
    entities: [...staged.entities],
    confidence: staged.proposal.confidence ?? 0.5,
  };
}

function classifierCandidate(
  candidate: RelationCandidate,
  index: number,
): RelationClassifierCandidate {
  return {
    handle: `candidate_${index + 1}`,
    proposition: candidate.item.proposition,
    kind: candidate.item.kind,
    tags: [...candidate.item.tags],
    scope: [...candidate.item.scope],
    authority: candidate.item.authority,
    confidence: candidate.item.confidence,
    activationStatus: candidate.item.activationStatus,
  };
}

export function serializeRelationClassifierInput(
  input: RelationClassifierInput,
): string {
  return JSON.stringify({
    ...(input.associationContext === undefined ? {} : { associationContext: {
      source: { origin: input.associationContext.source.origin, content: input.associationContext.source.content },
      entities: input.associationContext.entities.map(e => ({ handle: e.handle, labels: [...e.labels], type: e.type })),
      existing: input.associationContext.existing.map(e => ({ fromHandle: e.fromHandle, toHandle: e.toHandle, relation: e.relation, scope: [...e.scope] })),
    } }),
    ...(input.sourceSupport === undefined ? {} : { sourceSupport: input.sourceSupport }),
    proposal: {
      proposition: input.proposal.proposition,
      kind: input.proposal.kind,
      tags: [...input.proposal.tags],
      scope: [...input.proposal.scope],
      domains: [...input.proposal.domains],
      entities: [...input.proposal.entities],
      confidence: input.proposal.confidence,
    },
    candidates: input.candidates.map((candidate) => ({
      handle: candidate.handle,
      proposition: candidate.proposition,
      kind: candidate.kind,
      tags: [...candidate.tags],
      scope: [...candidate.scope],
      authority: candidate.authority,
      confidence: candidate.confidence,
      activationStatus: candidate.activationStatus,
    })),
  });
}

function sanitizedClassifierInput(
  input: RelationClassifierInput,
): RelationClassifierInput {
  return JSON.parse(serializeRelationClassifierInput(input)) as RelationClassifierInput;
}

function omittedClassifierField(value: unknown): boolean {
  return value === undefined || value === null;
}

function classifierRelationName(value: unknown): string | undefined {
  if (omittedClassifierField(value)) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new MemoryError(
      "policy",
      `relation classifier returned an unknown type: ${JSON.stringify(value)}`,
    );
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new MemoryError(
      "policy",
      `relation classifier returned an unknown type: ${JSON.stringify(value)}`,
    );
  }
  return normalized;
}

function classifierDecisionType(raw: Record<string, unknown>): string {
  const typeField = omittedClassifierField(raw.type) ? undefined : raw.type;
  const relationField = omittedClassifierField(raw.relation)
    ? undefined
    : raw.relation;
  if (typeField === undefined && relationField === undefined) {
    throw new MemoryError(
      "policy",
      "relation classifier decision is missing type",
    );
  }
  const typeName = classifierRelationName(typeField);
  const relationName = classifierRelationName(relationField);
  if (
    typeName !== undefined &&
    relationName !== undefined &&
    typeName !== relationName
  ) {
    throw new MemoryError(
      "policy",
      `relation classifier returned conflicting type fields: ${JSON.stringify(typeField)} vs ${JSON.stringify(relationField)}`,
    );
  }
  return typeName ?? relationName!;
}

function validatedClassifierDecision(
  value: unknown,
  handles: ReadonlyMap<string, RelationCandidate>,
): RelationClassifierDecision {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MemoryError("policy", "relation classifier decision must be an object");
  }
  const raw = value as Record<string, unknown>;
  const type = classifierDecisionType(raw);
  if (type === "new") {
    return { type };
  }
  if (type === "restatement" || type === "extend" || type === "supersede") {
    const targetHandle = nonEmpty(raw.targetHandle, "targetHandle");
    if (!handles.has(targetHandle)) {
      throw new MemoryError(
        "policy",
        `relation classifier selected an unknown handle: ${targetHandle}`,
      );
    }
    return { type, targetHandle };
  }
  if (type === "conflict") {
    if (!Array.isArray(raw.targetHandles) || raw.targetHandles.length === 0) {
      throw new MemoryError(
        "policy",
        "conflict requires at least one target handle",
      );
    }
    const targetHandles = raw.targetHandles.map((handle, index) =>
      nonEmpty(handle, `targetHandles ${index + 1}`),
    );
    if (new Set(targetHandles).size !== targetHandles.length) {
      throw new MemoryError("policy", "conflict target handles must be unique");
    }
    for (const handle of targetHandles) {
      if (!handles.has(handle)) {
        throw new MemoryError(
          "policy",
          `relation classifier selected an unknown handle: ${handle}`,
        );
      }
    }
    return { type, targetHandles };
  }
  throw new MemoryError(
    "policy",
    `relation classifier returned an unknown type: ${JSON.stringify(type)}`,
  );
}

function mappedDecision(
  decision: RelationClassifierDecision,
  handles: ReadonlyMap<string, RelationCandidate>,
): ReconciliationDecision {
  if (decision.type === "new") {
    return { type: "new" };
  }
  if (decision.type === "conflict") {
    return {
      type: "conflict",
      targetIds: decision.targetHandles.map(
        (handle) => handles.get(handle)!.item.id,
      ),
    };
  }
  return {
    type: decision.type,
    targetId: handles.get(decision.targetHandle)!.item.id,
  };
}

export class RelationGatedMemoryCommit {
  readonly #memory: RelationMemoryPort;
  readonly #candidateSource: RelationCandidateSource;
  readonly #classifier: KnowledgeRelationClassifier;
  readonly #budget: RelationClassifierBudget;
  readonly #indexWriter: RelationIndexWriter;
  readonly #maximumClassifierCandidates: number;
  readonly #activateNewProposal:
    | ((
        sourceMessage: string,
        proposal: KnowledgeProposal,
      ) => KnowledgeProposal)
    | undefined;
  #active = false;

  constructor(options: RelationGatedMemoryCommitOptions) {
    this.#memory = options.memory;
    this.#candidateSource = options.candidateSource;
    this.#classifier = options.classifier;
    this.#budget = {
      maximum: positiveSafeInteger(
        options.classifierBudget.maximum,
        "classifier budget maximum",
      ),
      measurer: options.classifierBudget.measurer,
    };
    nonEmpty(this.#budget.measurer.unit, "classifier measurement unit");
    this.#indexWriter = options.indexWriter;
    this.#maximumClassifierCandidates = positiveSafeInteger(
      options.maximumClassifierCandidates ?? 8,
      "maximumClassifierCandidates",
    );
    this.#activateNewProposal = options.activateNewProposal;
    if (
      this.#memory.projectId !== undefined &&
      this.#memory.projectId !== this.#indexWriter.projectId
    ) {
      throw new MemoryError(
        "invalid_input",
        "relation memory and index writer project namespaces differ",
      );
    }
  }

  async commit(
    input: RelationCommitInput,
    context: SemanticOperationContext = {},
  ): Promise<RelationGatedCommitResult> {
    this.#begin();
    try {
      const batch = input.batch;
      const projectId = parseRuntimeId(batch.projectId, "project");
      const conversationId = parseRuntimeId(
        batch.conversationId,
        "conversation",
      );
      const taskId = parseRuntimeId(batch.taskId, "task");
      const agentId = parseRuntimeId(batch.agentId, "agent");
      if (
        projectId !== this.#indexWriter.projectId ||
        (this.#memory.projectId !== undefined &&
          projectId !== this.#memory.projectId)
      ) {
        throw new MemoryError(
          "invalid_input",
          "staged batch project does not match relation storage namespace",
        );
      }
      if (!Array.isArray(batch.proposals)) {
        throw new MemoryError("invalid_input", "staged proposals must be an array");
      }
      if (
        !Number.isSafeInteger(input.proposalIndex) ||
        input.proposalIndex < 0 ||
        input.proposalIndex >= batch.proposals.length
      ) {
        throw new MemoryError("invalid_input", "proposalIndex is out of range");
      }
      const expectedSerialized = serializeStagedKnowledgeProposals(batch.proposals);
      if (batch.serialized !== expectedSerialized) {
        throw new MemoryError(
          "invalid_input",
          "staged batch serialization does not match its proposals",
        );
      }
      nonNegativeSafeInteger(batch.measuredUnits, "staged measuredUnits");
      nonEmpty(batch.measurementUnit, "staged measurementUnit");
      const staged = validatedStagedProposal(
        batch.proposals[input.proposalIndex]!,
      );
      const materialized = await this.#candidateSource.find({
        projectId,
        conversationId,
        taskId,
        agentId,
        staged,
      });
      const uniqueIds = new Set<string>();
      const validatedCandidates = materialized.map((candidate, index) => {
        const id = nonEmpty(candidate.item.id, `candidate ${index + 1} id`);
        if (uniqueIds.has(id)) {
          throw new MemoryError(
            "policy",
            `candidate source returned duplicate knowledge id: ${id}`,
          );
        }
        uniqueIds.add(id);
        if (
          candidate.item.canonicalStatus !== "current" ||
          !Number.isSafeInteger(candidate.item.revision) ||
          candidate.item.revision < 1
        ) {
          throw new MemoryError(
            "policy",
            `candidate source returned invalid current knowledge: ${id}`,
          );
        }
        return candidate;
      });
      let included = validatedCandidates.slice(
        0,
        this.#maximumClassifierCandidates,
      );
      let classifierInput: RelationClassifierInput;
      let serialized: string;
      let measuredUnits: number;
      while (true) {
        classifierInput = {
          proposal: classifierProposal(staged),
          candidates: included.map(classifierCandidate),
        };
        serialized = serializeRelationClassifierInput(classifierInput);
        measuredUnits = this.#budget.measurer.measure(serialized);
        if (!Number.isSafeInteger(measuredUnits) || measuredUnits < 0) {
          throw new MemoryError(
            "policy",
            "relation classifier measurer must return a non-negative safe integer",
          );
        }
        if (measuredUnits <= this.#budget.maximum) {
          break;
        }
        if (included.length === 0) {
          throw new MemoryError(
            "budget_exceeded",
            `relation classifier proposal uses ${measuredUnits} ${this.#budget.measurer.unit}; maximum is ${this.#budget.maximum}`,
          );
        }
        included = included.slice(0, -1);
      }

      const handles = new Map(
        included.map((candidate, index) => [
          `candidate_${index + 1}`,
          candidate,
        ]),
      );
      const untrusted: unknown = await this.#classifier.classify(
        sanitizedClassifierInput(classifierInput),
        context.signal === undefined ? {} : { signal: context.signal },
      );
      const classifierDecision = validatedClassifierDecision(untrusted, handles);
      const reconciliationDecision = mappedDecision(
        classifierDecision,
        handles,
      );
      const guard: ReconciliationGuard = {
        expectedRevisions: validatedCandidates.map((candidate) => ({
          id: candidate.item.id,
          revision: candidate.item.revision,
        })),
      };
      const sourceMessage =
        typeof batch.sourceMessage === "string" ? batch.sourceMessage.trim() : "";
      const proposal =
        reconciliationDecision.type === "new" &&
        this.#activateNewProposal !== undefined &&
        sourceMessage.length > 0
          ? this.#activateNewProposal(sourceMessage, staged.proposal)
          : staged.proposal;
      const reconciliation = await this.#memory.reconcile(
        proposal,
        reconciliationDecision,
        guard,
      );
      if (reconciliation.relation !== reconciliationDecision.type) {
        throw new MemoryError(
          "illegal_state",
          "memory returned a different reconciliation relation",
        );
      }

      let index: RelationIndexResult;
      if (reconciliation.item === null) {
        if (reconciliation.relation !== "conflict") {
          throw new MemoryError(
            "illegal_state",
            "non-conflict reconciliation returned no current item",
          );
        }
        index = { status: "not_required" };
      } else {
        const document: RetrievalDocument = {
          knowledgeId: reconciliation.item.id,
          entities: [...staged.entities],
          domains: [...staged.domains],
        };
        try {
          await this.#indexWriter.upsertRetrievalDocument(document);
          index = { status: "updated", document: copyDocument(document) };
        } catch (error) {
          index = {
            status: "pending_repair",
            document: copyDocument(document),
            error,
          };
        }
      }

      return {
        classifierDecision,
        reconciliationDecision,
        reconciliation,
        evidence: {
          materializedCandidateIds: validatedCandidates.map(
            (candidate) => candidate.item.id,
          ),
          classifierCandidateIds: included.map(
            (candidate) => candidate.item.id,
          ),
          classifierInputSerialized: serialized,
          classifierInputMeasuredUnits: measuredUnits,
          classifierInputMeasurementUnit: this.#budget.measurer.unit,
        },
        index,
      };
    } finally {
      this.#active = false;
    }
  }

  async repairIndex(
    pending: PendingRelationIndexRepair,
  ): Promise<UpdatedRelationIndex> {
    this.#begin();
    try {
      if (pending.status !== "pending_repair") {
        throw new MemoryError(
          "invalid_input",
          "repairIndex requires a pending_repair result",
        );
      }
      const document = copyDocument(pending.document);
      await this.#indexWriter.upsertRetrievalDocument(document);
      return { status: "updated", document };
    } finally {
      this.#active = false;
    }
  }

  #begin(): void {
    if (this.#active) {
      throw new MemoryError(
        "illegal_state",
        "relation-gated memory commit already has an active operation",
      );
    }
    this.#active = true;
  }
}
