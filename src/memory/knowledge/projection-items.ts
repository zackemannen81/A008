import { knowledgeText, serializeContextProjection } from "../serialization.js";
import type {
  ContextKnowledgeItem,
  SerializedContextMeasurer,
} from "../types.js";
import type { ClaimProposition, ProjectionPayload } from "./evidence-types.js";
import { asClaimId, asUtteranceId } from "./evidence.js";
import { asArtifactId } from "./ids.js";
import type {
  KnowledgeReadContext,
  RetrievedRecord,
  RetrievedSurface,
  SemanticScope,
} from "./read-types.js";
import type { Interval } from "./types.js";

/** Internal surface metadata only; never sent as an authority/truth score. */
export const SURFACE_AUTHORITY: Readonly<Record<RetrievedSurface, number>> = {
  state: 1,
  claim: 0.4,
  event: 0.35,
  history: 0.3,
  utterance: 0.2,
  artifact: 0.15,
  provenance: 0.1,
};
export const DEFAULT_PROJECTION_BUDGET_BYTES = 32_768;

export interface ProjectionItemsInput {
  readonly taskId: string;
  readonly payload: ProjectionPayload;
  readonly records?: readonly RetrievedRecord[];
  readonly context?: KnowledgeReadContext;
  readonly scope?: SemanticScope;
  /** This turn's specific labels; accumulated domains are discovery only. */
  readonly focusTags?: readonly string[];
  readonly message?: string;
  readonly measurer: SerializedContextMeasurer;
  readonly maximumBytes?: number;
}
export interface ProjectionItemsResult {
  readonly items: readonly ContextKnowledgeItem[];
  readonly omitted: readonly ContextKnowledgeItem[];
  readonly deduplicated: readonly ContextKnowledgeItem[];
}
interface Candidate {
  item: ContextKnowledgeItem;
  record?: RetrievedRecord;
  interval?: Interval;
  score: number;
}

export function projectionItems(
  input: ProjectionItemsInput,
): ProjectionItemsResult {
  const bySurface = new Map<RetrievedSurface, RetrievedRecord[]>();
  for (const record of input.records ?? []) {
    const bucket = bySurface.get(record.surface) ?? [];
    bucket.push(record);
    bySurface.set(record.surface, bucket);
  }
  const candidates: Candidate[] = [];
  const make = (
    surface: RetrievedSurface,
    index: number,
    text: string,
    address?: string,
    value?: unknown,
    interval?: Interval,
  ): Candidate => {
    const record = bySurface.get(surface)?.[index];
    const semanticAddress = record?.slotLabel ?? address;
    return {
      item: {
        id: record?.id ?? `${surface}:${index}`,
        ...(semanticAddress === undefined ? {} : { semanticAddress }),
        ...(record?.evidenceId ? { evidenceId: record.evidenceId } : {}),
        ...(surface === "state" ? { currentState: value } : {}),
        proposition: text,
        kind: surface,
        tags: [...(record?.tags ?? [])],
        ...(record ? { domains: [...record.domains] } : {}),
        scope: [],
        authority: SURFACE_AUTHORITY[surface],
      },
      ...(record ? { record } : {}),
      ...(interval ? { interval } : {}),
      score: record?.retrievalScore ?? 0,
    };
  };
  for (const [i, entry] of input.payload.state.entries()) {
    candidates.push(
      make(
        "state",
        i,
        knowledgeText(entry.value),
        entry.slot,
        entry.value,
        entry.interval,
      ),
    );
  }
  for (const [i, entry] of input.payload.claims.entries()) {
    candidates.push(
      make(
        "claim",
        i,
        entry.label,
        addressOf(entry.proposition, input.context),
        undefined,
        entry.aboutInterval,
      ),
    );
  }
  // An assertion without an extracted claim remains useful fallback evidence.
  // Questions, instructions and quotations never become unqualified claims.
  for (const [i, entry] of input.payload.utterances.entries()) {
    if (entry.act === "assertion")
      candidates.push(make("utterance", i, entry.content));
  }
  const wantsHistory =
    input.scope?.intents.some(
      (intent) => intent === "history" || intent === "event",
    ) ?? false;
  const wantsProvenance = input.scope?.intents.includes("attribution") ?? false;
  const history = input.payload.history.map((entry, i) =>
    make(
      "history",
      i,
      knowledgeText(entry.value),
      entry.slot,
      undefined,
      entry.interval,
    ),
  );
  if (wantsHistory) {
    for (const [i, entry] of input.payload.events.entries()) {
      const event = make("event", i, entry.label);
      event.item = {
        ...event.item,
        history: [
          dated(entry.label, { from: entry.eventTime, to: entry.eventTime }),
        ],
      };
      candidates.push(event);
    }
    // Retractions/closed timelines may have no present binding. Keep their last
    // known historical assertion explicitly qualified, never as currentState.
    for (const entry of [...history].sort((a, b) =>
      dateOf(b).localeCompare(dateOf(a)),
    )) {
      if (!candidates.some((other) => sameAddress(other, entry))) {
        candidates.push({
          ...entry,
          item: {
            ...entry.item,
            kind: "claim",
            proposition: `Historical: ${dated(entry.item.proposition, entry.interval)}`,
          },
        });
      }
    }
  }
  const omitted: ContextKnowledgeItem[] = [];
  const deduplicated: ContextKnowledgeItem[] = [];
  const usable = candidates.filter((candidate) => {
    const record = candidate.record;
    const closed =
      candidate.interval?.to !== undefined && candidate.interval.to !== null;
    const now = input.context?.evaluatedAt ?? input.context?.lifecycle.now();
    const future =
      now !== undefined &&
      typeof candidate.interval?.from === "string" &&
      candidate.interval.from > now;
    const rejected =
      record?.status === "rejected" || record?.status === "retracted";
    if (
      !candidate.item.proposition.trim() ||
      rejected ||
      (future && !input.scope?.temporalHints.mentionsFuture) ||
      (closed && !wantsHistory && candidate.item.kind !== "state")
    ) {
      omitted.push(candidate.item);
      return false;
    }
    return true;
  });

  const focus = new Set((input.focusTags ?? []).map(normalize));
  const focusMatch = (candidate: Candidate) =>
    candidate.item.tags.some((tag) => focus.has(normalize(tag)));
  const hasSpecificMatches = usable.some(focusMatch);
  const selected = usable.filter((candidate) => {
    const record = candidate.record;
    // Broad-domain membership is candidate discovery, not sufficient admission
    // when this question has more specific matches. Explicit address reads win.
    const domainOnly =
      record?.matchKind === "associative" &&
      record.reasons.includes("label_domain_match") &&
      !focusMatch(candidate) &&
      !record.reasons.includes("association_hop");
    const explicitAddress =
      candidate.item.semanticAddress !== undefined &&
      normalize(input.message ?? "").includes(
        normalize(candidate.item.semanticAddress),
      );
    if (hasSpecificMatches && domainOnly && !explicitAddress) {
      omitted.push(candidate.item);
      return false;
    }
    candidate.score += focusMatch(candidate) ? 10 : 0;
    return true;
  });

  // Current HEAD owns the address. Latest applicable claim is the fallback.
  // Equality of values alone never merges independent semantic addresses.
  const best = new Map<string, Candidate>();
  for (const candidate of selected) {
    const address = candidate.item.semanticAddress;
    const key = address
      ? `address:${address}`
      : `assertion:${normalize(candidate.item.proposition)}`;
    const existing = best.get(key);
    if (!existing) {
      best.set(key, candidate);
      continue;
    }
    const wins =
      (candidate.item.kind === "state" && existing.item.kind !== "state") ||
      (candidate.item.kind === existing.item.kind &&
        dateOf(candidate) > dateOf(existing)) ||
      (candidate.item.kind === "claim" && existing.item.kind === "utterance");
    if (wins) {
      best.set(key, candidate);
      deduplicated.push(existing.item);
    } else deduplicated.push(candidate.item);
  }
  const admitted = [...best.values()];
  // Raw assertions backing selected knowledge are not a second copy of it.
  const backingUtterances = new Set(
    admitted.flatMap((candidate) => {
      const claim =
        candidate.item.evidenceId &&
        input.context?.evidence.getClaim(asClaimId(candidate.item.evidenceId));
      return claim && claim.derivedFrom.kind === "utterance"
        ? [claim.derivedFrom.id]
        : [];
    }),
  );
  const ranked = admitted
    .filter((candidate) => {
      if (
        candidate.item.kind === "utterance" &&
        candidate.item.evidenceId &&
        backingUtterances.has(candidate.item.evidenceId)
      ) {
        deduplicated.push(candidate.item);
        return false;
      }
      return true;
    })
    .sort((a, b) => b.score - a.score || b.item.authority - a.item.authority);

  const items: ContextKnowledgeItem[] = [];
  for (const candidate of ranked) {
    let item = candidate.item;
    if (wantsHistory) {
      const prior = [
        ...history,
        ...usable.filter((entry) => entry.item.kind === "claim"),
      ]
        .filter(
          (entry) =>
            sameAddress(candidate, entry) &&
            entry.item.id !== candidate.item.id,
        )
        .sort((a, b) => dateOf(a).localeCompare(dateOf(b)))
        .map((entry) => dated(entry.item.proposition, entry.interval));
      if (prior.length) item = { ...item, history: [...new Set(prior)] };
    }
    if (
      wantsProvenance ||
      candidate.item.proposition.startsWith("[workspace:") ||
      candidate.item.semanticAddress?.includes("_workspace_") ||
      candidate.record?.status === "contested" ||
      (candidate.record?.certainty && candidate.record.certainty !== "certain")
    ) {
      const provenance = provenanceFor(candidate, input);
      if (candidate.record?.status === "contested") {
        for (const other of selected) {
          if (other !== candidate && sameAddress(candidate, other)) {
            provenance.push(
              `Competing claim: ${other.item.proposition}`,
              ...provenanceFor(other, input),
            );
          }
        }
      }
      if (provenance.length) item = { ...item, provenance };
    }
    const maximum = input.maximumBytes ?? DEFAULT_PROJECTION_BUDGET_BYTES;
    if (
      input.measurer.measure(
        serializeContextProjection({
          taskId: input.taskId,
          items: [...items, item],
        }),
      ) > maximum
    ) {
      omitted.push(item);
    } else items.push(item);
  }
  return { items, omitted, deduplicated };
}

function normalize(text: string): string {
  return text.trim().toLocaleLowerCase("und");
}
function sameAddress(a: Candidate, b: Candidate): boolean {
  return (
    a.item.semanticAddress !== undefined &&
    a.item.semanticAddress === b.item.semanticAddress
  );
}
function dateOf(candidate: Candidate): string {
  return typeof candidate.interval?.from === "string"
    ? candidate.interval.from
    : typeof candidate.record?.assertedAt === "string"
      ? candidate.record.assertedAt
      : "";
}
function dated(text: string, interval?: Interval): string {
  if (!interval) return text;
  const from =
    typeof interval.from === "string" ? interval.from : "unknown time";
  const to =
    typeof interval.to === "string"
      ? interval.to
      : interval.to === null
        ? "open"
        : "unknown time";
  return `${from} — ${to}: ${text}`;
}
function addressOf(
  proposition: ClaimProposition,
  context?: KnowledgeReadContext,
): string | undefined {
  if (!context || proposition.kind !== "attribute_binding") return undefined;
  const entities = context.entities.findByLabel(proposition.entityLabel);
  if (entities.length !== 1) return undefined;
  return `${entities[0]!.id}.${proposition.attribute}`;
}
function provenanceFor(
  candidate: Candidate,
  input: ProjectionItemsInput,
): string[] {
  const result: string[] = [];
  const record = candidate.record;
  const evidenceId = candidate.item.evidenceId;
  const claim =
    evidenceId && input.context?.evidence.getClaim(asClaimId(evidenceId));
  const speaker = claim
    ? claim.attributedTo
    : (record?.attributedTo ?? record?.speaker);
  if (speaker) result.push(`Attributed to: ${speaker}`);
  if (record?.status === "contested")
    result.push("Contested claim; not established current state.");
  if (record?.certainty && record.certainty !== "certain")
    result.push(`Certainty: ${record.certainty}`);
  const utteranceId =
    claim && claim.derivedFrom.kind === "utterance"
      ? claim.derivedFrom.id
      : record?.surface === "utterance"
        ? evidenceId
        : undefined;
  const utterance =
    utteranceId &&
    input.context?.evidence.getUtterance(asUtteranceId(utteranceId));
  if (utterance && typeof utterance.assertedAt === "string")
    result.push(`Asserted at: ${utterance.assertedAt}`);
  const artifactId = utterance
    ? utterance.artifactId
    : claim && claim.derivedFrom.kind === "artifact"
      ? claim.derivedFrom.id
      : undefined;
  const artifact =
    artifactId && input.context?.evidence.getArtifact(asArtifactId(artifactId));
  if (artifact) result.push(`Source: ${sourceLabel(artifact.locator)}`);
  for (const entry of input.payload.provenance) {
    if (
      entry.from.label === candidate.item.proposition ||
      entry.from.label === record?.label
    ) {
      result.push(
        `${entry.from.label} --${entry.relation}--> ${sourceLabel(entry.to.label)}`,
      );
    }
  }
  return [...new Set(result)];
}

function sourceLabel(locator: string): string {
  if (!locator.startsWith("turn:A008_v1_")) return locator;
  const fragment = locator.split("#")[1];
  const context = new URLSearchParams(fragment);
  return context.has("workspace")
    ? `conversation turn; workspace: ${context.get("workspace")}; revision: ${context.get("revision")}`
    : "conversation turn";
}
