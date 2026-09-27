import type { StagedKnowledgeBatch } from "../../orchestration/post-output-knowledge-intake.js";
import type { ClaimProposition } from "./evidence-types.js";
import { entitySlug } from "./registry.js";

export interface WorkspaceObservation {
  readonly workspaceId: string;
  readonly revision: string;
}
export function workspaceLabel(
  label: string,
  workspace: WorkspaceObservation,
): string {
  const suffix = ` [workspace:${workspace.workspaceId}]`;
  const slugSuffix = entitySlug(`workspace:${workspace.workspaceId}`);
  return label.endsWith(suffix) || entitySlug(label).endsWith(slugSuffix)
    ? label
    : `${label}${suffix}`;
}
function scoped(
  proposition: ClaimProposition,
  workspace: WorkspaceObservation,
): ClaimProposition {
  if (proposition.kind === "attribute_binding")
    return {
      ...proposition,
      entityLabel: workspaceLabel(proposition.entityLabel, workspace),
    };
  if (proposition.kind === "relationship_binding")
    return {
      ...proposition,
      subjectLabel: workspaceLabel(proposition.subjectLabel, workspace),
      objectLabel: workspaceLabel(proposition.objectLabel, workspace),
    };
  if (proposition.kind === "negation")
    return { ...proposition, of: scoped(proposition.of, workspace) };
  return proposition;
}
/** Qualify session observations without changing their values or support spans. */
export function scopeWorkspaceBatch(
  batch: StagedKnowledgeBatch,
  workspace: WorkspaceObservation,
): StagedKnowledgeBatch {
  const prefix = `[workspace:${workspace.workspaceId}] `;
  return {
    ...batch,
    proposals: batch.proposals.map((entry) => ({
      ...entry,
      proposal: {
        ...entry.proposal,
        proposition: entry.proposal.proposition.startsWith(prefix)
          ? entry.proposal.proposition
          : prefix + entry.proposal.proposition,
        ...(entry.proposal.structuredProposition
          ? {
              structuredProposition: scoped(
                entry.proposal.structuredProposition,
                workspace,
              ),
            }
          : {}),
      },
    })),
  };
}
