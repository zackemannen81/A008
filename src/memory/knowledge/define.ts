import { KnowledgeModelError } from "./errors.js";
import { slotKey } from "./registry.js";
import type {
  KnowledgeReadContext,
  RetrievalIntent,
  SemanticScope,
  TemporalHints,
  VerifiedReadScope,
} from "./read-types.js";
import type { SlotRef } from "./types.js";

const PLANNER_CURRENT = /\b(nu|aktuell|current|now|latest|senaste)\b/u;
const PLANNER_PAST = /\b(tidigare|förut|histor|past|previous|before)\b/u;
const PLANNER_FUTURE =
  /\b(senare|framtid|future|later|next|imorgon|tomorrow)\b/u;

const HISTORY_PATTERN =
  /\b(haft|hade|tidigare|förut|histor|past|previous|before|used to|had)\b/iu;
const EVENT_PATTERN =
  /\b(målade|painted|who\s+(painted|did)|vem\s+(målade|gjorde)|happened|inträffade)\b/iu;
const ATTRIBUTION_PATTERN =
  /\b(vad\s+sa|vem\s+sa|who\s+said|what\s+did\b[\s\S]*\bsay|sa\s+presentatören|attributed)\b/iu;
const ASSOCIATIVE_PATTERN =
  /\b(berätta|tell me about|något om|something about)\b/iu;
const CURRENT_PATTERN =
  /\b(vilken färg har|what (color|colour)|where is|what does|äger|regnar det|defined|return)\b/iu;

export interface DefineInput {
  readonly message: string;
  readonly verifiedScope: VerifiedReadScope;
  readonly temporalHints?: TemporalHints;
  readonly task?: string;
}

export function define(
  input: DefineInput,
  context: KnowledgeReadContext,
): SemanticScope {
  if (
    input.verifiedScope === undefined ||
    input.verifiedScope.verified !== true
  ) {
    throw new KnowledgeModelError(
      "invalid_input",
      "DEFINE requires verified runtime scope",
    );
  }
  if (typeof input.message !== "string") {
    throw new KnowledgeModelError("invalid_input", "message must be a string");
  }

  const temporalHints = mergeTemporalHints(input.message, input.temporalHints);
  const intents = classifyIntents(input.message, temporalHints);
  const tags = unique([...(input.verifiedScope.tags ?? [])]);
  const domains = unique([...(input.verifiedScope.domains ?? [])]);
  const entityLabels = unique([
    ...(input.verifiedScope.entities ?? []),
    ...matchEntityLabels(input.message, context),
  ]);
  const slots = uniqueSlots([
    ...(input.verifiedScope.slots ?? []),
    ...discoverSlots(input.message, entityLabels, context),
  ]);

  return {
    tags,
    domains,
    entities: entityLabels,
    slots,
    intents,
    temporalHints,
  };
}

export function classifyIntents(
  message: string,
  temporalHints: TemporalHints,
): readonly RetrievalIntent[] {
  const detected: RetrievalIntent[] = [];
  if (HISTORY_PATTERN.test(message) || temporalHints.mentionsPast) {
    detected.push("history");
  }
  if (EVENT_PATTERN.test(message)) {
    detected.push("event");
  }
  if (ATTRIBUTION_PATTERN.test(message)) {
    detected.push("attribution");
  }
  if (ASSOCIATIVE_PATTERN.test(message)) {
    detected.push("associative");
  }
  if (CURRENT_PATTERN.test(message) || temporalHints.currentOnly) {
    detected.push("current_state");
  }
  if (detected.length === 0) {
    // Current state is the default truth surface. Attribution is opt-in: raw
    // claims/utterances must not accompany an ordinary state question merely
    // because no stronger intent word was present.
    return ["current_state"];
  }
  if (detected.length === 1 && detected[0] === "associative") {
    return ["associative"];
  }
  return uniqueIntents(detected);
}

function mergeTemporalHints(
  message: string,
  provided: TemporalHints | undefined,
): TemporalHints {
  const lower = message.toLocaleLowerCase("sv-SE");
  return {
    currentOnly:
      (provided?.currentOnly ?? false) || PLANNER_CURRENT.test(lower),
    mentionsPast:
      (provided?.mentionsPast ?? false) ||
      PLANNER_PAST.test(lower) ||
      HISTORY_PATTERN.test(message),
    mentionsFuture:
      (provided?.mentionsFuture ?? false) || PLANNER_FUTURE.test(lower),
  };
}

function matchEntityLabels(
  message: string,
  context: KnowledgeReadContext,
): readonly string[] {
  const labels: string[] = [];
  for (const entity of context.entities.list()) {
    for (const label of entity.labels) {
      if (mentionsLabel(message, label) && !labels.includes(label)) {
        labels.push(label);
      }
    }
  }
  return labels;
}

function discoverSlots(
  message: string,
  entityLabels: readonly string[],
  context: KnowledgeReadContext,
): readonly SlotRef[] {
  const matched = new Map<string, SlotRef>();
  const entityIds = new Set<string>();
  for (const entity of context.entities.list()) {
    if (entity.labels.some((label) => entityLabels.includes(label))) {
      entityIds.add(entity.id);
    }
    if (entity.labels.some((label) => mentionsLabel(message, label))) {
      entityIds.add(entity.id);
    }
  }
  const wantsColor = /\b(färg|färger|color|colour)\b/iu.test(message);
  const wantsReturn = /\b(return|returns|return_type)\b/iu.test(message);
  const wantsWhere = /\b(where|defined|innehåll|contains)\b/iu.test(message);

  for (const slot of context.slots.list()) {
    const ref = slot.ref;
    let include = false;
    if (ref.kind === "attribute") {
      if (entityIds.has(ref.entity)) {
        include = true;
        if (wantsColor && ref.name !== "color") {
          include = false;
        }
        if (wantsReturn && ref.name !== "return_type") {
          include = false;
        }
        if (wantsWhere && ref.name === "return_type") {
          include = false;
        }
        if (!wantsColor && !wantsReturn && !wantsWhere) {
          include = true;
        }
      }
    } else {
      const subject = String(ref.subject);
      const object = ref.object === undefined ? "" : String(ref.object);
      if (
        entityIds.has(subject) ||
        (object.length > 0 && entityIds.has(object))
      ) {
        include = true;
        if (wantsReturn) {
          include = false;
        }
      }
    }
    if (include) {
      matched.set(slotKey(ref), cloneSlotRef(ref));
    }
  }
  return [...matched.values()];
}

export function mentionsLabel(message: string, label: string): boolean {
  const haystack = normalize(message);
  for (const variant of labelVariants(label)) {
    if (variant.length === 0) {
      continue;
    }
    if (haystack.includes(variant)) {
      return true;
    }
  }
  return false;
}

export function labelVariants(label: string): readonly string[] {
  const normalized = normalize(label);
  const variants = new Set<string>([normalized]);
  if (normalized.endsWith("()")) {
    variants.add(normalized.slice(0, -2));
  }
  if (normalized.includes("_")) {
    variants.add(normalized.replaceAll("_", " "));
  }
  return [...variants];
}

export function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("sv-SE");
}

function unique(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function uniqueIntents(
  intents: readonly RetrievalIntent[],
): readonly RetrievalIntent[] {
  const seen = new Set<RetrievalIntent>();
  const result: RetrievalIntent[] = [];
  for (const intent of intents) {
    if (seen.has(intent)) {
      continue;
    }
    seen.add(intent);
    result.push(intent);
  }
  return result;
}

function uniqueSlots(slots: readonly SlotRef[]): readonly SlotRef[] {
  const seen = new Set<string>();
  const result: SlotRef[] = [];
  for (const slot of slots) {
    const key = slotKey(slot);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(cloneSlotRef(slot));
  }
  return result;
}

function cloneSlotRef(ref: SlotRef): SlotRef {
  if (ref.kind === "attribute") {
    return {
      kind: "attribute",
      entity: ref.entity,
      name: ref.name,
    };
  }
  return ref.object === undefined
    ? { kind: "relation", subject: ref.subject, name: ref.name }
    : {
        kind: "relation",
        subject: ref.subject,
        name: ref.name,
        object: ref.object,
      };
}
