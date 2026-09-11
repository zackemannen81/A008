import { KnowledgeModelError } from "./errors.js";
import { allowsUserAssertionAcceptance, asUtteranceId } from "./evidence.js";
import type { EvidenceStore } from "./evidence.js";
import {
  USER_ASSERTION_POLICY_ID,
  type AcceptanceDecision,
  type Claim,
  type ClaimId,
  type ClaimStatus,
  type ReconcileOutcome,
  type Utterance,
} from "./evidence-types.js";
import {
  isExplicitAssertionEvidence,
  type AssertionEvidenceSpan,
} from "./assertion-evidence.js";

export interface AcceptAuthority {
  readonly verified: boolean;
  readonly speakerRole: "user" | "third_party";
}

export interface AcceptInput {
  readonly claimId: ClaimId;
  readonly policy: { readonly id: string };
  readonly authority: AcceptAuthority;
  readonly reconcileOutcome?: ReconcileOutcome;
  readonly competingClaimIds?: readonly ClaimId[];
  readonly sourceMessage?: string;
  readonly sourceSpan?: AssertionEvidenceSpan;
  readonly confidence?: number;
}

export interface AcceptResult {
  readonly claim: Claim;
  readonly decision: AcceptanceDecision;
  readonly policyId: string;
  readonly reason: string;
}

export function accept(input: AcceptInput, store: EvidenceStore): AcceptResult {
  const policyId = requirePolicyId(input.policy?.id);
  if (input.authority === undefined || input.authority.verified !== true) {
    throw new KnowledgeModelError(
      "invalid_input",
      "ACCEPT requires verified authority",
    );
  }

  const claim = store.requireClaim(input.claimId);
  const utterance = utteranceFor(store, claim);

  if (input.reconcileOutcome === "conflict") {
    return applyStatus(
      store,
      input.claimId,
      "contested",
      {
        policyId,
        decision: "contested",
        reason: "reconcile outcome is conflict; competing claims are retained",
      },
      input.competingClaimIds,
    );
  }

  if (input.reconcileOutcome === "retraction") {
    return applyStatus(store, input.claimId, "retracted", {
      policyId,
      decision: "rejected",
      reason: "source retracted the claim",
    });
  }

  if (policyId !== USER_ASSERTION_POLICY_ID) {
    throw new KnowledgeModelError(
      "invalid_input",
      `ACCEPT policy ${policyId} is not identified`,
    );
  }

  return applyUserAssertionPolicy(input, store, claim, utterance);
}

function applyUserAssertionPolicy(
  input: AcceptInput,
  store: EvidenceStore,
  claim: Claim,
  utterance: Utterance | undefined,
): AcceptResult {
  const policyId = USER_ASSERTION_POLICY_ID;
  const hasScopedEvidence = input.sourceSpan !== undefined;

  if (
    utterance !== undefined &&
    !allowsUserAssertionAcceptance(utterance.act) &&
    !hasScopedEvidence
  ) {
    return applyStatus(store, claim.id, "asserted", {
      policyId,
      decision: "not_accepted",
      reason: `user-assertion-v1 does not accept speech act ${utterance.act} without assertion-scoped evidence`,
    });
  }

  if (input.authority.speakerRole !== "user") {
    return applyStatus(store, claim.id, "asserted", {
      policyId,
      decision: "not_accepted",
      reason: "user-assertion-v1 applies to verified user assertions only",
    });
  }

  if (input.sourceMessage !== undefined) {
    const utteranceText = utterance?.content ?? claim.label;
    const matchesUtterance = isExplicitAssertionEvidence(
      input.sourceMessage,
      utteranceText,
      input.sourceSpan,
    );
    const matchesLabel = isExplicitAssertionEvidence(
      input.sourceMessage,
      claim.label,
      input.sourceSpan,
    );
    if (!matchesUtterance && !matchesLabel) {
      return applyStatus(store, claim.id, "asserted", {
        policyId,
        decision: "not_accepted",
        reason: "source evidence is not an explicit user assertion of the claim",
      });
    }
  }

  return applyStatus(store, claim.id, "accepted", {
    policyId,
    decision: "accepted",
    reason: "user-assertion-v1 accepted a verified user assertion",
  });
}

function utteranceFor(
  store: EvidenceStore,
  claim: Claim,
): Utterance | undefined {
  if (claim.derivedFrom.kind !== "utterance") {
    return undefined;
  }
  return store.getUtterance(asUtteranceId(claim.derivedFrom.id));
}

function applyStatus(
  store: EvidenceStore,
  claimId: ClaimId,
  status: ClaimStatus,
  decision: {
    readonly policyId: string;
    readonly decision: AcceptanceDecision;
    readonly reason: string;
  },
  competingClaimIds?: readonly ClaimId[],
): AcceptResult {
  const claim = store.applyAcceptance(claimId, status, decision);
  if (status === "contested" && competingClaimIds !== undefined) {
    for (const competingId of competingClaimIds) {
      if (competingId === claimId) {
        continue;
      }
      store.applyAcceptance(competingId, "contested", decision);
    }
  }
  assertNoLifecycleFields(claim);
  return {
    claim,
    decision: decision.decision,
    policyId: decision.policyId,
    reason: decision.reason,
  };
}

function requirePolicyId(policyId: string | undefined): string {
  if (policyId === undefined || policyId.trim().length === 0) {
    throw new KnowledgeModelError(
      "invalid_input",
      "ACCEPT requires an identified policy",
    );
  }
  return policyId.trim();
}

function assertNoLifecycleFields(claim: Claim): void {
  if (
    Object.prototype.hasOwnProperty.call(claim, "keepAlive") ||
    Object.prototype.hasOwnProperty.call(claim, "strength") ||
    Object.prototype.hasOwnProperty.call(claim, "memoryStrength") ||
    Object.prototype.hasOwnProperty.call(claim, "activation")
  ) {
    throw new KnowledgeModelError(
      "invalid_proposal",
      "ACCEPT must not write keepAlive or strength",
    );
  }
}
