import { KnowledgeModelError } from "./errors.js";
import type { ClaimProposition } from "./evidence-types.js";

function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new KnowledgeModelError(
      "invalid_input",
      `${field} must be a non-empty string`,
    );
  }
  return value.trim();
}

function stringArray(
  value: unknown,
  field: string,
): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new KnowledgeModelError("invalid_input", `${field} must be an array`);
  }
  return value.map((entry, index) => nonEmpty(entry, `${field} ${index + 1}`));
}

export function parseClaimProposition(value: unknown): ClaimProposition {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new KnowledgeModelError(
      "invalid_input",
      "structuredProposition must be an object",
    );
  }
  const raw = value as Record<string, unknown>;
  const kind = nonEmpty(raw.kind, "structuredProposition.kind");

  if (kind === "attribute_binding") {
    return {
      kind,
      entityLabel: nonEmpty(
        raw.entityLabel,
        "structuredProposition.entityLabel",
      ),
      attribute: nonEmpty(raw.attribute, "structuredProposition.attribute"),
      value: structuredClone(raw.value),
    };
  }
  if (kind === "relationship_binding") {
    return {
      kind,
      subjectLabel: nonEmpty(
        raw.subjectLabel,
        "structuredProposition.subjectLabel",
      ),
      relation: nonEmpty(raw.relation, "structuredProposition.relation"),
      objectLabel: nonEmpty(
        raw.objectLabel,
        "structuredProposition.objectLabel",
      ),
    };
  }
  if (kind === "event_occurrence") {
    const participants = stringArray(
      raw.participants,
      "structuredProposition.participants",
    );
    return {
      kind,
      type: nonEmpty(raw.type, "structuredProposition.type"),
      ...(participants === undefined ? {} : { participants }),
    };
  }
  if (kind === "predicate") {
    return {
      kind,
      name: nonEmpty(raw.name, "structuredProposition.name"),
      arguments:
        stringArray(raw.arguments, "structuredProposition.arguments") ?? [],
    };
  }
  if (kind === "negation") {
    return {
      kind,
      of: parseClaimProposition(raw.of),
    };
  }

  throw new KnowledgeModelError(
    "invalid_input",
    `unsupported structured proposition kind ${kind}`,
  );
}
