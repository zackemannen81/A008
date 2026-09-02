import { KnowledgeModelError } from "./errors.js";
import type {
  Entity,
  EntityId,
  SlotDefinition,
  SlotRef,
} from "./types.js";

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
}

function cloneEntity(entity: Entity): Entity {
  return {
    id: entity.id,
    type: entity.type,
    labels: [...entity.labels],
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
