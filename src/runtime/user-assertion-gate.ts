import type { KnowledgeProposal } from "../memory/types.js";

const MINIMUM_PROPOSITION_CHARS = 8;
const USER_ASSERTION_AUTHORITY = 0.8;

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("und");
}

export function isExplicitUserAssertion(
  message: string,
  proposition: string,
): boolean {
  const normalizedMessage = collapse(message);
  const normalizedProposition = collapse(proposition);
  if (normalizedProposition.length < MINIMUM_PROPOSITION_CHARS) {
    return false;
  }
  if (normalizedMessage.endsWith("?")) {
    return false;
  }
  return normalizedMessage.includes(normalizedProposition);
}

export function applyUserAssertionActivation(
  message: string,
  proposal: KnowledgeProposal,
): KnowledgeProposal {
  if (!isExplicitUserAssertion(message, proposal.proposition)) {
    return {
      ...proposal,
      tags: [...(proposal.tags ?? [])],
      scope: [...proposal.scope],
      provenance: [...(proposal.provenance ?? [])],
    };
  }
  return {
    ...proposal,
    tags: [...(proposal.tags ?? [])],
    scope: [...proposal.scope],
    keepAlive: true,
    sourceBacked: true,
    authority: Math.max(proposal.authority ?? 0, USER_ASSERTION_AUTHORITY),
    provenance: [
      ...(proposal.provenance ?? []),
      { sourceId: "user-message", sourceType: "user-assertion" },
    ],
  };
}
