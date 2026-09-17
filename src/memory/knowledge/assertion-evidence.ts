const MINIMUM_PROPOSITION_CHARS = 8;

const REQUEST_OR_IMPERATIVE_PREFIX =
  /^\s*(?:lägg(?:\s+till)?|skapa|ändra|uppdatera|ta\s+bort|gör|visa|kan\s+du|please|add|create|update|remove|show|make)\b/iu;

export interface AssertionEvidenceSpan {
  readonly start: number;
  readonly end: number;
}

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("und");
}

function evidenceSlice(
  message: string,
  span: AssertionEvidenceSpan | undefined,
): string {
  if (span === undefined) {
    return message;
  }
  if (
    !Number.isSafeInteger(span.start) ||
    !Number.isSafeInteger(span.end) ||
    span.start < 0 ||
    span.end <= span.start ||
    span.end > message.length
  ) {
    return "";
  }
  return message.slice(span.start, span.end);
}

/**
 * Deterministic user-assertion boundary.
 *
 * When an exact support span exists, speech-act checks are applied to that
 * evidence span rather than to the whole mixed utterance. This lets
 * "Kan du fixa X? Dokumenten ligger i Y." support the factual Y-claim without
 * turning the request to fix X into world state.
 */
export function isExplicitAssertionEvidence(
  message: string,
  proposition: string,
  span?: AssertionEvidenceSpan,
): boolean {
  const normalizedProposition = collapse(proposition);
  if (normalizedProposition.length < MINIMUM_PROPOSITION_CHARS) {
    return false;
  }

  const evidence = evidenceSlice(message, span);
  if (evidence.length === 0) {
    return false;
  }
  const normalizedEvidence = collapse(evidence);
  if (
    normalizedEvidence.endsWith("?") ||
    REQUEST_OR_IMPERATIVE_PREFIX.test(normalizedEvidence)
  ) {
    return false;
  }
  return normalizedEvidence.includes(normalizedProposition);
}
