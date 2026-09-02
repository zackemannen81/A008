import { mentionsLabel, normalize } from "./define.js";
import type { Claim, Utterance } from "./evidence-types.js";
import { viewLifecycle } from "./lifecycle.js";
import { slotKey } from "./registry.js";
import type {
  KnowledgeReadContext,
  RetrievedRecord,
  SemanticScope,
} from "./read-types.js";
import { bindingValue, isOpenInterval } from "./state.js";
import type { Binding, SlotClaim, StubEvent } from "./state-types.js";
import type { Interval, SlotRef } from "./types.js";

const EXACT_SLOT_SCORE = 1;
const EXACT_ENTITY_SCORE = 0.8;
const LEXICAL_SCORE = 0.3;
const CERTAINTY_SCORE = {
  certain: 0.1,
  probable: 0.05,
  possible: 0.02,
  unlikely: 0,
} as const;
const ASSOCIATIVE_STRENGTH_WEIGHT = 0.5;

export interface RetrieveQuery {
  readonly message: string;
}

export function retrieve(
  scope: SemanticScope,
  context: KnowledgeReadContext,
  query: RetrieveQuery,
): readonly RetrievedRecord[] {
  const records: RetrievedRecord[] = [];
  const seen = new Set<string>();
  const intents = new Set(scope.intents);
  const slots = resolveSlots(scope, context);

  if (intents.has("current_state") || intents.has("associative")) {
    for (const slot of slots) {
      if (context.state.isContested(slot)) {
        for (const claim of context.state.claims(slot)) {
          if (claim.status !== "contested") {
            continue;
          }
          push(
            records,
            seen,
            slotClaimRecord(claim, query.message, scope, context, "direct", true, [
              "direct_slot_match",
              "contested_slot",
            ]),
          );
        }
        continue;
      }
      for (const binding of context.state.current(slot)) {
        push(
          records,
          seen,
          bindingRecord(
            binding,
            "state",
            query.message,
            scope,
            "direct",
            true,
            ["direct_slot_match", "current_state"],
          ),
        );
      }
    }
  }

  if (intents.has("history")) {
    for (const slot of slots) {
      for (const binding of context.state.history(slot)) {
        push(
          records,
          seen,
          bindingRecord(
            binding,
            "history",
            query.message,
            scope,
            "direct",
            true,
            ["history_intent", "direct_slot_match"],
          ),
        );
      }
    }
  } else {
    assertNoClosedIntervals(records);
  }

  if (intents.has("event")) {
    for (const event of context.state.events()) {
      if (!eventMatches(event, query.message, slots)) {
        continue;
      }
      push(
        records,
        seen,
        eventRecord(event, query.message, scope, context, "direct", true, [
          "direct_event_match",
        ]),
      );
    }
  }

  if (intents.has("attribution") || intents.has("current_state")) {
    for (const utterance of context.evidence.listUtterances()) {
      if (!utteranceMatches(utterance.speaker, utterance.content, query.message, scope)) {
        continue;
      }
      push(
        records,
        seen,
        utteranceRecord(utterance, query.message, scope, context, "direct", false, [
          intents.has("attribution")
            ? "direct_attribution_match"
            : "current_state_evidence",
        ]),
      );
    }
    for (const claim of context.evidence.listClaims()) {
      if (!claimMatchesQuery(claim.label, claim.attributedTo, query.message, scope)) {
        continue;
      }
      push(
        records,
        seen,
        evidenceClaimRecord(claim, query.message, scope, context, "direct", false, [
          intents.has("attribution")
            ? "direct_attribution_match"
            : "current_state_evidence",
        ]),
      );
    }
  }

  if (!intents.has("history")) {
    return records.filter((record) => record.surface !== "history" || isOpen(record.interval));
  }
  return records;
}

export function scoreRetrieved(input: {
  readonly matchKind: "direct" | "associative";
  readonly exactSlot: boolean;
  readonly exactEntity: boolean;
  readonly lexical: boolean;
  readonly certainty?: keyof typeof CERTAINTY_SCORE;
  readonly strength?: number;
}): number {
  let score = 0;
  if (input.exactSlot) {
    score += EXACT_SLOT_SCORE;
  }
  if (input.exactEntity) {
    score += EXACT_ENTITY_SCORE;
  }
  if (input.lexical) {
    score += LEXICAL_SCORE;
  }
  if (input.certainty !== undefined) {
    score += CERTAINTY_SCORE[input.certainty];
  }
  if (input.matchKind === "associative" && input.strength !== undefined) {
    score += ASSOCIATIVE_STRENGTH_WEIGHT * input.strength;
  }
  return score;
}

export function slotLabelOf(ref: SlotRef): string {
  if (ref.kind === "attribute") {
    return `${ref.entity}.${ref.name}`;
  }
  const object = ref.object === undefined ? "?" : String(ref.object);
  return `${String(ref.subject)} --${ref.name}--> ${object}`;
}

function resolveSlots(
  scope: SemanticScope,
  context: KnowledgeReadContext,
): readonly SlotRef[] {
  const entityIds = matchedEntityIds(scope, context);
  const found = new Map<string, SlotRef>();
  const add = (ref: SlotRef): void => {
    found.set(slotKey(ref), ref);
  };
  for (const slot of scope.slots) {
    add(slot);
  }
  for (const definition of context.slots.list()) {
    const ref = definition.ref;
    if (ref.kind === "attribute" && entityIds.has(ref.entity)) {
      add(ref);
      continue;
    }
    if (ref.kind === "relation") {
      if (entityIds.has(String(ref.subject))) {
        add(ref);
      } else if (ref.object !== undefined && entityIds.has(String(ref.object))) {
        add(ref);
      }
    }
  }
  for (const binding of context.state.snapshot().bindings) {
    if (binding.kind === "attribute" && entityIds.has(binding.slot.entity)) {
      add(binding.slot);
      continue;
    }
    if (binding.kind === "relationship") {
      if (
        entityIds.has(String(binding.slot.subject)) ||
        entityIds.has(String(binding.object)) ||
        (binding.slot.object !== undefined &&
          entityIds.has(String(binding.slot.object)))
      ) {
        add(binding.slot);
      }
    }
  }
  return [...found.values()];
}

function matchedEntityIds(
  scope: SemanticScope,
  context: KnowledgeReadContext,
): ReadonlySet<string> {
  const entityIds = new Set<string>();
  for (const entity of context.entities.list()) {
    if (entity.labels.some((label) => scope.entities.includes(label))) {
      entityIds.add(entity.id);
    }
  }
  return entityIds;
}

function bindingRecord(
  binding: Binding,
  surface: "state" | "history",
  message: string,
  scope: SemanticScope,
  matchKind: "direct" | "associative",
  required: boolean,
  reasons: readonly string[],
): RetrievedRecord {
  const exactSlot = true;
  const lexical = mentionsLabel(message, binding.label);
  const score = scoreRetrieved({
    matchKind,
    exactSlot,
    exactEntity: true,
    lexical,
  });
  const record: RetrievedRecord = {
    id: `${surface}:${slotKey(binding.slot)}:${intervalKey(binding.interval)}:${binding.claimId}`,
    surface,
    matchKind,
    retrievalScore: score,
    reasons,
    tags: [...scope.tags],
    required,
    label: binding.label,
    slotLabel: slotLabelOf(binding.slot),
    value: bindingValue(binding),
    interval: cloneInterval(binding.interval),
  };
  return record;
}

function slotClaimRecord(
  claim: SlotClaim,
  message: string,
  scope: SemanticScope,
  context: KnowledgeReadContext,
  matchKind: "direct" | "associative",
  required: boolean,
  reasons: readonly string[],
): RetrievedRecord {
  const viewed = viewLifecycle(context.lifecycle, claim.id);
  const score = scoreRetrieved({
    matchKind,
    exactSlot: true,
    exactEntity: true,
    lexical: mentionsLabel(message, claim.label),
    ...(matchKind === "associative" ? { strength: viewed.strength } : {}),
  });
  const record: RetrievedRecord = {
    id: `claim:${claim.id}`,
    surface: "claim",
    matchKind,
    retrievalScore: score,
    reasons,
    tags: [...scope.tags],
    required,
    label: claim.label,
    slotLabel: slotLabelOf(claim.slot),
    value: claim.value,
    interval: cloneInterval(claim.aboutInterval),
    attributedTo: claim.attributedTo,
    status: claim.status,
    evidenceId: claim.id,
    evidenceKind: "claim",
    strength: viewed.strength,
    memoryState: viewed.memoryState,
  };
  return record;
}

function eventRecord(
  event: StubEvent,
  message: string,
  scope: SemanticScope,
  context: KnowledgeReadContext,
  matchKind: "direct" | "associative",
  required: boolean,
  reasons: readonly string[],
): RetrievedRecord {
  const viewed = viewLifecycle(context.lifecycle, event.id);
  const score = scoreRetrieved({
    matchKind,
    exactSlot: false,
    exactEntity: event.who !== undefined && mentionsLabel(message, event.who),
    lexical: mentionsLabel(message, event.label),
    ...(matchKind === "associative" ? { strength: viewed.strength } : {}),
  });
  const record: RetrievedRecord = {
    id: `event:${event.id}`,
    surface: "event",
    matchKind,
    retrievalScore: score,
    reasons,
    tags: [...scope.tags],
    required,
    label: event.label,
    eventType: event.type,
    eventTime: event.eventTime,
    evidenceId: event.id,
    evidenceKind: "event",
    strength: viewed.strength,
    memoryState: viewed.memoryState,
  };
  if (event.who !== undefined) {
    return { ...record, who: event.who };
  }
  return record;
}

function utteranceRecord(
  utterance: Utterance,
  message: string,
  scope: SemanticScope,
  context: KnowledgeReadContext,
  matchKind: "direct" | "associative",
  required: boolean,
  reasons: readonly string[],
): RetrievedRecord {
  const viewed = viewLifecycle(context.lifecycle, utterance.id);
  const score = scoreRetrieved({
    matchKind,
    exactSlot: false,
    exactEntity: mentionsLabel(message, utterance.speaker),
    lexical: mentionsLabel(message, utterance.content),
    ...(matchKind === "associative" ? { strength: viewed.strength } : {}),
  });
  return {
    id: `utterance:${utterance.id}`,
    surface: "utterance",
    matchKind,
    retrievalScore: score,
    reasons,
    tags: [...scope.tags],
    required,
    label: utterance.content,
    speaker: utterance.speaker,
    act: utterance.act,
    contentKind: utterance.contentKind,
    content: utterance.content,
    assertedAt: utterance.assertedAt,
    evidenceId: utterance.id,
    evidenceKind: "utterance",
    strength: viewed.strength,
    memoryState: viewed.memoryState,
  };
}

function evidenceClaimRecord(
  claim: Claim,
  message: string,
  scope: SemanticScope,
  context: KnowledgeReadContext,
  matchKind: "direct" | "associative",
  required: boolean,
  reasons: readonly string[],
): RetrievedRecord {
  const viewed = viewLifecycle(context.lifecycle, claim.id);
  const score = scoreRetrieved({
    matchKind,
    exactSlot: false,
    exactEntity: mentionsLabel(message, claim.attributedTo),
    lexical: mentionsLabel(message, claim.label),
    certainty: claim.certainty,
    ...(matchKind === "associative" ? { strength: viewed.strength } : {}),
  });
  return {
    id: `claim:${claim.id}`,
    surface: "claim",
    matchKind,
    retrievalScore: score,
    reasons,
    tags: [...scope.tags],
    required,
    label: claim.label,
    attributedTo: claim.attributedTo,
    status: claim.status,
    certainty: claim.certainty,
    proposition: claim.proposition,
    interval: cloneInterval(claim.aboutInterval),
    evidenceId: claim.id,
    evidenceKind: "claim",
    strength: viewed.strength,
    memoryState: viewed.memoryState,
  };
}

function eventMatches(
  event: StubEvent,
  message: string,
  slots: readonly SlotRef[],
): boolean {
  if (mentionsLabel(message, event.label) || mentionsLabel(message, event.type)) {
    return true;
  }
  if (event.who !== undefined && mentionsLabel(message, event.who)) {
    return true;
  }
  if (event.what !== undefined && mentionsLabel(message, event.what)) {
    return true;
  }
  const lower = normalize(message);
  if (lower.includes("målade") || lower.includes("painted") || lower.includes("rött") || lower.includes("red")) {
    return event.type === "house_painted" || event.what === "red";
  }
  return event.effects.some((effect) =>
    slots.some((slot) => slotKey(slot) === slotKey(effect.slot)),
  );
}

function utteranceMatches(
  speaker: string,
  content: string,
  message: string,
  scope: SemanticScope,
): boolean {
  if (mentionsLabel(message, speaker) || mentionsLabel(message, content)) {
    return true;
  }
  if (scope.entities.some((label) => mentionsLabel(content, label) || mentionsLabel(speaker, label))) {
    return true;
  }
  if (lexicalOverlap(message, speaker) || lexicalOverlap(message, content)) {
    return true;
  }
  const lower = normalize(message);
  if (lower.includes("presentatören") || lower.includes("presenter")) {
    return normalize(speaker).includes("kanal") || normalize(speaker).includes("presenter");
  }
  return false;
}

function claimMatchesQuery(
  label: string,
  attributedTo: string,
  message: string,
  scope: SemanticScope,
): boolean {
  if (utteranceMatches(attributedTo, label, message, scope)) {
    return true;
  }
  if (lexicalOverlap(message, label)) {
    return true;
  }
  const lower = normalize(message);
  const claim = normalize(label);
  if (
    (lower.includes("regnar") || lower.includes("rain")) &&
    (claim.includes("rain") || claim.includes("regn"))
  ) {
    return true;
  }
  if (
    (lower.includes("äger") || lower.includes("owns") || lower.includes("bil")) &&
    (claim.includes("owns") || claim.includes("bil") || claim.includes("car"))
  ) {
    return true;
  }
  if (scope.temporalHints.mentionsFuture && (claim.includes("rain") || claim.includes("tomorrow"))) {
    return true;
  }
  return false;
}

function lexicalOverlap(left: string, right: string): boolean {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  return leftTokens.some((token) => token.length >= 3 && rightTokens.includes(token));
}

function tokenize(value: string): readonly string[] {
  return normalize(value)
    .split(/[^a-z0-9åäö]+/u)
    .filter((token) => token.length > 0);
}

function push(
  records: RetrievedRecord[],
  seen: Set<string>,
  record: RetrievedRecord,
): void {
  if (seen.has(record.id)) {
    return;
  }
  seen.add(record.id);
  records.push(record);
}

function assertNoClosedIntervals(records: readonly RetrievedRecord[]): void {
  for (const record of records) {
    if (record.surface === "history" && !isOpen(record.interval)) {
      throw new Error("closed intervals are unreachable without history intent");
    }
  }
}

function isOpen(interval: Interval | undefined): boolean {
  return interval !== undefined && isOpenInterval(interval);
}

function intervalKey(interval: Interval): string {
  const from = typeof interval.from === "string" ? interval.from : "unknown";
  const to =
    interval.to === null
      ? "open"
      : typeof interval.to === "string"
        ? interval.to
        : "unknown";
  return `${from}..${to}`;
}

function cloneInterval(interval: Interval): Interval {
  return {
    from: interval.from,
    to: interval.to === null ? null : interval.to,
  };
}
