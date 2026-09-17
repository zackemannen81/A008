import { KnowledgeModelError } from "./errors.js";
import type { ArtifactId, EntityId } from "./types.js";

function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new KnowledgeModelError(
      "invalid_input",
      `${field} must not be empty`,
    );
  }
  return trimmed;
}

export function asArtifactId(value: string): ArtifactId {
  return requireNonEmpty(value, "artifact id") as ArtifactId;
}

export function asEntityId(value: string): EntityId {
  return requireNonEmpty(value, "entity id") as EntityId;
}

export function isArtifactId(value: unknown): value is ArtifactId {
  return typeof value === "string" && value.trim().length > 0;
}

export function isEntityId(value: unknown): value is EntityId {
  return typeof value === "string" && value.trim().length > 0;
}
