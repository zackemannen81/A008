import { KnowledgeModelError } from "./errors.js";
import { asEntityId } from "./ids.js";
import type {
  Entity,
  EntityId,
  SlotDefinition,
  SlotRef,
} from "./types.js";

/** Deterministic identity for an entity label. Empty labels have no slug. */
export function entitySlug(label: string): string {
  return label
    .trim()
    .toLocaleLowerCase("und")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

export function slotKey(ref: SlotRef): string {
  if (ref.kind === "attribute") {
    return `attribute:${ref.entity}:${ref.name}`;
  }
  const object = ref.object === undefined ? "" : ref.object;
  return `relation:${ref.subject}:${ref.name}:${object}`;
}

export class EntityRegistry {
  readonly #byId = new Map<EntityId, Entity>();

  get(id: EntityId): Entity | undefined {
    const entity = this.#byId.get(id);
    return entity === undefined ? undefined : cloneEntity(entity);
  }

  list(): readonly Entity[] {
    return [...this.#byId.values()].map(cloneEntity);
  }

  findByLabel(label: string, type?: string): readonly Entity[] {
    const matches: Entity[] = [];
    for (const entity of this.#byId.values()) {
      if (type !== undefined && entity.type !== type) {
        continue;
      }
      if (entity.labels.includes(label)) {
        matches.push(cloneEntity(entity));
      }
    }
    return matches;
  }

  /**
   * Reuse an entity whose label, id or any alias slugs to the same identity.
   * Exact label wins; otherwise the slug id; otherwise a slug-equivalent alias.
   */
  findByIdentity(label: string, type?: string): Entity | undefined {
    const trimmed = label.trim();
    if (trimmed.length === 0) return undefined;
    const labeled = this.findByLabel(trimmed, type);
    if (labeled.length > 0) return labeled[0];
    const slug = entitySlug(trimmed);
    if (slug.length === 0) return undefined;
    const byId = this.#byId.get(asEntityId(slug));
    if (byId !== undefined && (type === undefined || byId.type === type)) {
      return cloneEntity(byId);
    }
    for (const entity of this.#byId.values()) {
      if (type !== undefined && entity.type !== type) continue;
      if (entity.labels.some((item) => entitySlug(item) === slug)) {
        return cloneEntity(entity);
      }
    }
    return undefined;
  }

  resolve(
    label: string,
    type?: string,
  ):
    | { readonly status: "resolved"; readonly entity: Entity }
    | { readonly status: "absent" }
    | { readonly status: "ambiguous"; readonly candidates: readonly Entity[] } {
    const matches = this.findByLabel(label, type);
    if (matches.length === 0) {
      return { status: "absent" };
    }
    if (matches.length === 1) {
      const entity = matches[0];
      if (entity === undefined) {
        return { status: "absent" };
      }
      return { status: "resolved", entity };
    }
    return { status: "ambiguous", candidates: matches };
  }

  register(entity: Entity): void {
    if (this.#byId.has(entity.id)) {
      throw new KnowledgeModelError(
        "invalid_input",
        `entity ${entity.id} is already registered`,
      );
    }
    this.#byId.set(entity.id, cloneEntity(entity));
  }

  /** Deterministically resolve or create one referent without aliasing co-mentioned entities. */
  ensure(label: string, type = "entity"): Entity {
    const trimmed = label.trim();
    const slug = entitySlug(trimmed);
    if (trimmed.length === 0 || slug.length === 0) {
      throw new KnowledgeModelError("invalid_input", "entity label must have a deterministic identity");
    }
    const existing = this.findByIdentity(trimmed);
    if (existing !== undefined) {
      const stored = this.#byId.get(existing.id)!;
      const sameIdentityLabel = stored.labels.some((item) => entitySlug(item) === slug);
      const labels = sameIdentityLabel ? [...stored.labels] : [...stored.labels, trimmed];
      const preferredLabel = preferredEntityLabel(stored.preferredLabel ?? stored.labels[0] ?? trimmed, trimmed);
      const updated: Entity = { ...stored, labels, preferredLabel };
      this.#byId.set(updated.id, updated);
      return cloneEntity(updated);
    }
    const entity: Entity = {
      id: asEntityId(slug),
      type,
      labels: [trimmed],
      preferredLabel: trimmed,
    };
    this.#byId.set(entity.id, entity);
    return cloneEntity(entity);
  }

  hydrate(entities: readonly Entity[]): void {
    this.#byId.clear();
    for (const entity of entities) {
      this.#byId.set(entity.id, cloneEntity(entity));
    }
  }
}

export class SlotRegistry {
  readonly #byKey = new Map<string, SlotDefinition>();

  get(ref: SlotRef): SlotDefinition | undefined {
    const definition = this.#byKey.get(slotKey(ref));
    return definition === undefined ? undefined : cloneSlot(definition);
  }

  list(): readonly SlotDefinition[] {
    return [...this.#byKey.values()].map(cloneSlot);
  }

  register(definition: SlotDefinition): void {
    const key = slotKey(definition.ref);
    if (this.#byKey.has(key)) {
      throw new KnowledgeModelError(
        "invalid_input",
        `slot ${key} is already registered`,
      );
    }
    this.#byKey.set(key, cloneSlot(definition));
  }

  /**
   * Widens a single-valued slot to a set. The only redefinition allowed.
   *
   * A slot definition is durable and `register` refuses to overwrite one, which
   * is right: silently changing what a slot means would reinterpret every
   * binding already stored under it. Widening is the one direction that
   * reinterprets nothing — a set admits everything a single slot held, and
   * every current binding stays current.
   *
   * Narrowing is refused, because it would orphan bindings that are legal today.
   */
  widenToSet(ref: SlotRef): SlotDefinition {
    const key = slotKey(ref);
    const existing = this.#byKey.get(key);
    if (existing === undefined) {
      throw new KnowledgeModelError(
        "invalid_input",
        `slot ${key} is not registered`,
      );
    }
    if (existing.cardinality === "set") {
      return cloneSlot(existing);
    }
    const widened: SlotDefinition = { ...cloneSlot(existing), cardinality: "set" };
    this.#byKey.set(key, widened);
    return cloneSlot(widened);
  }

  hydrate(definitions: readonly SlotDefinition[]): void {
    this.#byKey.clear();
    for (const definition of definitions) {
      this.#byKey.set(slotKey(definition.ref), cloneSlot(definition));
    }
  }
}

function preferredEntityLabel(current: string, incoming: string): string {
  if (entitySlug(current) !== entitySlug(incoming)) return current;
  const currentHasCase = current.toLocaleLowerCase("und") !== current;
  const incomingHasCase = incoming.toLocaleLowerCase("und") !== incoming;
  return !currentHasCase && incomingHasCase ? incoming : current;
}

function cloneEntity(entity: Entity): Entity {
  return {
    id: entity.id,
    type: entity.type,
    labels: [...entity.labels],
    ...(entity.preferredLabel === undefined ? {} : { preferredLabel: entity.preferredLabel }),
  };
}

function cloneSlot(definition: SlotDefinition): SlotDefinition {
  if (definition.ref.kind === "attribute") {
    return {
      ref: {
        kind: "attribute",
        entity: definition.ref.entity,
        name: definition.ref.name,
      },
      cardinality: definition.cardinality,
      valueType: definition.valueType,
    };
  }
  const relationRef =
    definition.ref.object === undefined
      ? {
          kind: "relation" as const,
          subject: definition.ref.subject,
          name: definition.ref.name,
        }
      : {
          kind: "relation" as const,
          subject: definition.ref.subject,
          name: definition.ref.name,
          object: definition.ref.object,
        };
  return {
    ref: relationRef,
    cardinality: definition.cardinality,
    valueType: definition.valueType,
  };
}
