import { createHash } from "node:crypto";
import type { ClaimCertainty } from "./evidence-types.js";

export const MAX_WRITE_DOMAINS_PER_UTTERANCE = 4;

export function selectUtteranceDomains(
  proposals: readonly { readonly domains: readonly string[] }[],
): readonly string[] {
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const proposal of proposals) {
    for (const domain of proposal.domains) {
      if (seen.has(domain)) continue;
      seen.add(domain);
      selected.push(domain);
      if (selected.length === MAX_WRITE_DOMAINS_PER_UTTERANCE) {
        return selected;
      }
    }
  }
  return selected;
}

export function certaintyFromConfidence(
  confidence: number | undefined,
): ClaimCertainty {
  const value = confidence ?? 0.5;
  if (value >= 0.9) return "certain";
  if (value >= 0.65) return "probable";
  if (value >= 0.35) return "possible";
  return "unlikely";
}

export function statementEntityLabel(proposition: string): string {
  const digest = createHash("sha256").update(proposition).digest("hex").slice(0, 12);
  return `statement_${digest}`;
}
