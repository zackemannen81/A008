import { KnowledgeModelError } from "./errors.js";
import type { EntityId } from "./types.js";

export interface ClaimEntityReference {
  readonly claimId: string;
  readonly entityId: EntityId;
}

/**
 * Structural claim-to-entity membership.
 *
 * This is deliberately not RelationIndex. A reference only says that an
 * extracted claim is about / names an entity. It has no semantic relation
 * type, source proof, strength, reinforcement, decay or retrieval lifecycle.
 */
export class ClaimEntityReferenceStore {
  readonly #byClaim = new Map<string, Set<EntityId>>();
  readonly #byEntity = new Map<EntityId, Set<string>>();

  attach(
    claimId: string,
    entityIds: readonly EntityId[],
  ): readonly ClaimEntityReference[] {
    const claim = requireNonEmpty(claimId, "claimId");
    const unique = [...new Set(entityIds)];
    for (const entityId of unique) {
      const claimEntities = this.#byClaim.get(claim) ?? new Set<EntityId>();
      claimEntities.add(entityId);
      this.#byClaim.set(claim, claimEntities);
      const entityClaims = this.#byEntity.get(entityId) ?? new Set<string>();
      entityClaims.add(claim);
      this.#byEntity.set(entityId, entityClaims);
    }
    return this.forClaim(claim);
  }

  forClaim(claimId: string): readonly ClaimEntityReference[] {
    const ids = this.#byClaim.get(claimId) ?? new Set<EntityId>();
    return [...ids]
      .sort((a, b) => String(a).localeCompare(String(b)))
      .map((entityId) => ({ claimId, entityId }));
  }

  forEntity(entityId: EntityId): readonly ClaimEntityReference[] {
    const ids = this.#byEntity.get(entityId) ?? new Set<string>();
    return [...ids]
      .sort((a, b) => a.localeCompare(b))
      .map((claimId) => ({ claimId, entityId }));
  }

  list(): readonly ClaimEntityReference[] {
    const records: ClaimEntityReference[] = [];
    for (const claimId of [...this.#byClaim.keys()].sort()) {
      records.push(...this.forClaim(claimId));
    }
    return records;
  }

  hydrate(records: readonly ClaimEntityReference[]): void {
    this.#byClaim.clear();
    this.#byEntity.clear();
    for (const record of records) {
      this.attach(record.claimId, [record.entityId]);
    }
  }
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new KnowledgeModelError(
      "invalid_input",
      `${field} must not be empty`,
    );
  }
  return normalized;
}
