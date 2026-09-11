import type { KnowledgeProposal } from "../memory/types.js";
import {
  isExplicitAssertionEvidence,
  type AssertionEvidenceSpan,
} from "../memory/knowledge/assertion-evidence.js";

const USER_ASSERTION_AUTHORITY = 0.8;

export function isExplicitUserAssertion(
  message: string,
  proposition: string,
  support?: AssertionEvidenceSpan,
): boolean {
  return isExplicitAssertionEvidence(message, proposition, support);
}

export function applyUserAssertionActivation(
  message: string,
  proposal: KnowledgeProposal,
  support?: AssertionEvidenceSpan,
): KnowledgeProposal {
  if (!isExplicitUserAssertion(message, proposal.proposition, support)) {
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
