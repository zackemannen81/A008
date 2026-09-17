import { MemoryError } from "./errors.js";
import type {
  KnowledgeItem,
  MemoryAuditEvent,
  MemoryAuditEventInput,
  MemoryReadView,
  MemoryRepository,
  MemoryTransaction,
  ProvenanceRef,
} from "./types.js";

function cloneProvenance(provenance: ProvenanceRef): ProvenanceRef {
  return { ...provenance };
}

function cloneItem(item: KnowledgeItem): KnowledgeItem {
  return {
    ...item,
    tags: [...item.tags],
    scope: [...item.scope],
    provenance: item.provenance.map(cloneProvenance),
  };
}

function cloneAudit(event: MemoryAuditEvent): MemoryAuditEvent {
  return {
    ...event,
    knowledgeIds: [...event.knowledgeIds],
    selectedKnowledgeIds: [...event.selectedKnowledgeIds],
  };
}

function requireNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new MemoryError("illegal_state", `${field} must not be empty`);
  }
}

function requireUnitInterval(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new MemoryError(
      "illegal_state",
      `${field} must be a finite number between 0 and 1`,
    );
  }
}

function requireDistinctNonEmpty(
  values: readonly string[],
  field: string,
): void {
  const normalized = values.map((value) => value.trim());
  if (normalized.some((value) => value.length === 0)) {
    throw new MemoryError(
      "illegal_state",
      `${field} must not contain empty values`,
    );
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new MemoryError(
      "illegal_state",
      `${field} must not contain duplicates`,
    );
  }
}

function validateItem(item: KnowledgeItem): void {
  requireNonEmpty(item.id, "knowledge id");
  requireNonEmpty(item.proposition, "knowledge proposition");
  requireNonEmpty(item.kind, "knowledge kind");
  requireDistinctNonEmpty(item.tags, "knowledge tags");
  requireDistinctNonEmpty(item.scope, "knowledge scope");
  requireUnitInterval(item.relevanceScore, "relevanceScore");
  requireUnitInterval(item.activationThreshold, "activationThreshold");
  requireUnitInterval(item.authority, "authority");
  requireUnitInterval(item.confidence, "confidence");
  if (!Number.isSafeInteger(item.revision) || item.revision < 1) {
    throw new MemoryError(
      "illegal_state",
      "knowledge revision must be a positive safe integer",
    );
  }
  for (const provenance of item.provenance) {
    requireNonEmpty(provenance.sourceId, "provenance sourceId");
    requireNonEmpty(provenance.sourceType, "provenance sourceType");
  }
  if (item.canonicalStatus === "current" && item.supersededBy !== null) {
    throw new MemoryError(
      "illegal_state",
      `current knowledge ${item.id} cannot have supersededBy`,
    );
  }
  if (item.canonicalStatus === "superseded") {
    if (item.supersededBy === null || item.supersededBy === item.id) {
      throw new MemoryError(
        "illegal_state",
        `superseded knowledge ${item.id} requires another successor`,
      );
    }
    if (item.activationStatus !== "dormant") {
      throw new MemoryError(
        "illegal_state",
        `superseded knowledge ${item.id} cannot remain active`,
      );
    }
  }
}

function validateState(items: ReadonlyMap<string, KnowledgeItem>): void {
  for (const [id, item] of items) {
    if (id !== item.id) {
      throw new MemoryError(
        "illegal_state",
        `repository key mismatch for ${id}`,
      );
    }
    validateItem(item);
    if (item.supersededBy !== null && !items.has(item.supersededBy)) {
      throw new MemoryError(
        "illegal_state",
        `knowledge ${item.id} references missing successor ${item.supersededBy}`,
      );
    }
  }

  const completed = new Set<string>();
  for (const id of items.keys()) {
    if (completed.has(id)) {
      continue;
    }
    const path = new Set<string>();
    let nextId: string | null = id;
    while (nextId !== null && !completed.has(nextId)) {
      if (path.has(nextId)) {
        throw new MemoryError(
          "illegal_state",
          `supersede cycle detected at ${nextId}`,
        );
      }
      path.add(nextId);
      nextId = items.get(nextId)?.supersededBy ?? null;
    }
    for (const pathId of path) {
      completed.add(pathId);
    }
  }
}

class ReadView implements MemoryReadView {
  constructor(protected readonly items: Map<string, KnowledgeItem>) {}

  get(id: string): KnowledgeItem | undefined {
    const item = this.items.get(id);
    return item === undefined ? undefined : cloneItem(item);
  }

  list(ids: readonly string[]): readonly KnowledgeItem[] {
    return ids
      .map((id) => this.items.get(id))
      .filter((item): item is KnowledgeItem => item !== undefined)
      .map(cloneItem);
  }

  listKeepAlive(): readonly KnowledgeItem[] {
    return [...this.items.values()]
      .filter((item) => item.canonicalStatus === "current" && item.keepAlive)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(cloneItem);
  }

  listCurrent(): readonly KnowledgeItem[] {
    return [...this.items.values()]
      .filter((item) => item.canonicalStatus === "current")
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(cloneItem);
  }

  listAll(): readonly KnowledgeItem[] {
    return [...this.items.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(cloneItem);
  }

  historyFrom(id: string): readonly KnowledgeItem[] {
    const history: KnowledgeItem[] = [];
    const visited = new Set<string>();
    let nextId: string | null = id;

    while (nextId !== null) {
      if (visited.has(nextId)) {
        throw new MemoryError(
          "illegal_state",
          `supersede cycle detected at ${nextId}`,
        );
      }
      visited.add(nextId);
      const item = this.items.get(nextId);
      if (item === undefined) {
        break;
      }
      history.push(cloneItem(item));
      nextId = item.supersededBy;
    }

    return history;
  }
}

class Transaction extends ReadView implements MemoryTransaction {
  constructor(
    items: Map<string, KnowledgeItem>,
    private readonly audit: MemoryAuditEvent[],
  ) {
    super(items);
  }

  insert(item: KnowledgeItem): void {
    if (this.items.has(item.id)) {
      throw new MemoryError(
        "duplicate_id",
        `knowledge id already exists: ${item.id}`,
      );
    }
    this.items.set(item.id, cloneItem(item));
  }

  replace(item: KnowledgeItem): void {
    if (!this.items.has(item.id)) {
      throw new MemoryError(
        "missing_target",
        `knowledge id does not exist: ${item.id}`,
      );
    }
    this.items.set(item.id, cloneItem(item));
  }

  appendAudit(input: MemoryAuditEventInput): MemoryAuditEvent {
    const event: MemoryAuditEvent = {
      ...input,
      sequence: (this.audit.at(-1)?.sequence ?? 0) + 1,
      knowledgeIds: [...input.knowledgeIds],
      selectedKnowledgeIds: [...input.selectedKnowledgeIds],
    };
    this.audit.push(event);
    return cloneAudit(event);
  }
}

export class InMemoryMemoryRepository implements MemoryRepository {
  private items: Map<string, KnowledgeItem>;
  private audit: MemoryAuditEvent[];
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(
    initialItems: readonly KnowledgeItem[] = [],
    initialAudit: readonly MemoryAuditEvent[] = [],
  ) {
    const duplicateCheck = new Set<string>();
    for (const item of initialItems) {
      if (duplicateCheck.has(item.id)) {
        throw new MemoryError(
          "duplicate_id",
          `duplicate initial knowledge id: ${item.id}`,
        );
      }
      duplicateCheck.add(item.id);
    }
    this.items = new Map(
      initialItems.map((item) => [item.id, cloneItem(item)]),
    );
    this.audit = initialAudit.map(cloneAudit);
    validateState(this.items);
  }

  async read<T>(reader: (view: MemoryReadView) => T | Promise<T>): Promise<T> {
    await this.transactionTail;
    const snapshot = new Map(
      [...this.items].map(([id, item]) => [id, cloneItem(item)]),
    );
    return reader(new ReadView(snapshot));
  }

  async transact<T>(
    operation: (transaction: MemoryTransaction) => T | Promise<T>,
  ): Promise<T> {
    const previous = this.transactionTail;
    let release: () => void = () => undefined;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    const workingItems = new Map(
      [...this.items].map(([id, item]) => [id, cloneItem(item)]),
    );
    const workingAudit = this.audit.map(cloneAudit);

    try {
      const result = await operation(
        new Transaction(workingItems, workingAudit),
      );
      validateState(workingItems);
      this.items = workingItems;
      this.audit = workingAudit;
      return result;
    } finally {
      release();
    }
  }

  async readAudit(): Promise<readonly MemoryAuditEvent[]> {
    await this.transactionTail;
    return this.audit.map(cloneAudit);
  }
}
