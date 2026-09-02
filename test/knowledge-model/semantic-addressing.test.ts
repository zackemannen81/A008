import assert from "node:assert/strict";
import test from "node:test";
import {
  asEntityId,
  deserializeInstant,
  deserializeInterval,
  EntityRegistry,
  interpret,
  isUnknownInstant,
  serializeInstant,
  serializeInterval,
  SlotRegistry,
  UNKNOWN_INSTANT,
} from "../../src/memory/knowledge/index.js";
import type {
  Entity,
  InterpretProposal,
  KnowledgeIdFactory,
  ProposedBinding,
} from "../../src/memory/knowledge/index.js";

const S3_CONTENT = "int main() { ... }";

function sequentialIds(): KnowledgeIdFactory {
  let sequence = 0;
  return () => String(++sequence).padStart(4, "0");
}

function interpretSource(
  content: string,
  options: {
    readonly locator?: string;
    readonly entities?: EntityRegistry;
    readonly slots?: SlotRegistry;
    readonly idFactory?: KnowledgeIdFactory;
    readonly ingestedAt?: typeof UNKNOWN_INSTANT | string;
  } = {},
): {
  readonly proposal: InterpretProposal;
  readonly entities: EntityRegistry;
  readonly slots: SlotRegistry;
} {
  const entities = options.entities ?? new EntityRegistry();
  const slots = options.slots ?? new SlotRegistry();
  const proposal = interpret(
    {
      contentKind: "source_code",
      locator: options.locator ?? "main.cpp",
      content,
      ...(options.ingestedAt === undefined
        ? {}
        : { ingestedAt: options.ingestedAt }),
    },
    {
      entities,
      slots,
      idFactory: options.idFactory ?? sequentialIds(),
    },
  );
  return { proposal, entities, slots };
}

function relationshipBindings(
  proposal: InterpretProposal,
): readonly ProposedBinding[] {
  return proposal.bindings.filter((binding) => binding.kind === "relationship");
}

function attributeBindings(
  proposal: InterpretProposal,
): readonly ProposedBinding[] {
  return proposal.bindings.filter((binding) => binding.kind === "attribute");
}

function hasWhoOrWhy(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, "who")) {
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(value, "why")) {
    return true;
  }
  return Object.values(value).some(hasWhoOrWhy);
}

test("S3 — source code INTERPRET proposes one artifact, one symbol, typed relation and attribute", () => {
  const { proposal, entities, slots } = interpretSource(S3_CONTENT);

  assert.equal(proposal.artifacts.length, 1);
  const artifact = proposal.artifacts[0];
  assert.ok(artifact);
  assert.equal(artifact.contentKind, "source_code");
  assert.equal(artifact.locator, "main.cpp");
  assert.equal(artifact.language, "C++");
  assert.equal(artifact.confidence, 1);

  assert.equal(proposal.entities.length, 1);
  const symbol = proposal.entities[0];
  assert.ok(symbol);
  assert.equal(symbol.type, "symbol");
  assert.deepEqual(symbol.labels, ["main()"]);
  assert.notEqual(symbol.id, "main()");
  assert.notEqual(symbol.id, symbol.labels[0]);
  assert.equal(symbol.confidence, 1);

  const contains = relationshipBindings(proposal);
  assert.equal(contains.length, 1);
  const relationship = contains[0];
  assert.ok(relationship);
  assert.equal(relationship.kind, "relationship");
  assert.equal(relationship.slot.kind, "relation");
  assert.equal(relationship.slot.subject, artifact.id);
  assert.equal(relationship.slot.name, "contains");
  assert.equal(relationship.slot.object, symbol.id);
  assert.equal(relationship.object, symbol.id);
  assert.equal(relationship.label, "main.cpp --contains--> main()");
  assert.equal(relationship.confidence, 1);

  const attributes = attributeBindings(proposal);
  assert.equal(attributes.length, 1);
  const returnType = attributes[0];
  assert.ok(returnType);
  assert.equal(returnType.kind, "attribute");
  assert.equal(returnType.slot.kind, "attribute");
  assert.equal(returnType.slot.entity, symbol.id);
  assert.equal(returnType.slot.name, "return_type");
  assert.equal(returnType.value, "int");
  assert.equal(returnType.label, "main().return_type = int");
  assert.equal(returnType.confidence, 1);

  const containsSlot = proposal.slots.find(
    (slot) =>
      slot.definition.ref.kind === "relation" &&
      slot.definition.ref.name === "contains",
  );
  assert.ok(containsSlot);
  assert.equal(containsSlot.definition.cardinality, "set");
  assert.equal("object" in containsSlot.definition.ref, false);

  const returnTypeSlot = proposal.slots.find(
    (slot) =>
      slot.definition.ref.kind === "attribute" &&
      slot.definition.ref.name === "return_type",
  );
  assert.ok(returnTypeSlot);
  assert.equal(returnTypeSlot.definition.cardinality, "single");

  assert.equal(proposal.events.length, 0);
  assert.equal(proposal.claims.length, 0);
  assert.equal(proposal.unresolvedReferences.length, 0);
  assert.equal(hasWhoOrWhy(proposal), false);
  assert.equal(entities.list().length, 0);
  assert.equal(slots.list().length, 0);
});

test("unknown Instant and Interval round-trip without defaulting to now", () => {
  const { proposal } = interpretSource(S3_CONTENT, {
    ingestedAt: UNKNOWN_INSTANT,
  });
  const artifact = proposal.artifacts[0];
  assert.ok(artifact);
  assert.equal(isUnknownInstant(artifact.ingestedAt), true);
  assert.deepEqual(artifact.ingestedAt, { unknown: true });

  const serializedInstant = serializeInstant(artifact.ingestedAt);
  assert.equal(serializedInstant, '{"unknown":true}');
  assert.deepEqual(deserializeInstant(serializedInstant), { unknown: true });

  const known = serializeInstant("2026-09-02T00:00:00.000Z");
  assert.equal(deserializeInstant(known), "2026-09-02T00:00:00.000Z");

  const interval = { from: UNKNOWN_INSTANT, to: null };
  const serializedInterval = serializeInterval(interval);
  assert.deepEqual(deserializeInterval(serializedInterval), {
    from: { unknown: true },
    to: null,
  });
});

test("INTERPRET writes nothing to entity and slot registries", () => {
  const entities = new EntityRegistry();
  const slots = new SlotRegistry();
  const existing: Entity = {
    id: asEntityId("existing-symbol"),
    type: "symbol",
    labels: ["other()"],
  };
  entities.register(existing);

  const beforeEntities = entities.list();
  const beforeSlots = slots.list();
  const { proposal } = interpretSource(S3_CONTENT, { entities, slots });

  assert.equal(proposal.entities.length, 1);
  assert.deepEqual(entities.list(), beforeEntities);
  assert.deepEqual(slots.list(), beforeSlots);
});

test("failed entity resolution yields an unresolved-reference record, not a guessed entity", () => {
  const { proposal } = interpretSource("int main() { helper(); }");

  assert.equal(proposal.entities.length, 1);
  assert.deepEqual(proposal.entities[0]?.labels, ["main()"]);
  assert.equal(
    proposal.entities.some((entity) => entity.labels.includes("helper()")),
    false,
  );
  assert.equal(proposal.unresolvedReferences.length, 1);
  const unresolved = proposal.unresolvedReferences[0];
  assert.ok(unresolved);
  assert.equal(unresolved.label, "helper()");
  assert.equal(unresolved.role, "entity");
  assert.match(unresolved.reason, /no matching symbol; no guess was made/);
  assert.equal(
    proposal.bindings.some(
      (binding) =>
        binding.kind === "relationship" && binding.slot.object === "helper()",
    ),
    false,
  );
});

test("ambiguous entity resolution does not guess a binding", () => {
  const entities = new EntityRegistry();
  entities.register({
    id: asEntityId("main-a"),
    type: "symbol",
    labels: ["main()"],
  });
  entities.register({
    id: asEntityId("main-b"),
    type: "symbol",
    labels: ["main()"],
  });

  const { proposal } = interpretSource(S3_CONTENT, { entities });

  assert.equal(proposal.entities.length, 0);
  assert.equal(proposal.bindings.length, 0);
  assert.equal(proposal.unresolvedReferences.length, 1);
  assert.equal(proposal.unresolvedReferences[0]?.label, "main()");
  assert.match(
    proposal.unresolvedReferences[0]?.reason ?? "",
    /more than one symbol/,
  );
});

test("INTERPRET reuses a uniquely resolved registry entity instead of minting identity from the label", () => {
  const entities = new EntityRegistry();
  entities.register({
    id: asEntityId("already-main"),
    type: "symbol",
    labels: ["main()"],
  });

  const { proposal } = interpretSource(S3_CONTENT, { entities });

  assert.equal(proposal.entities.length, 0);
  const returnType = attributeBindings(proposal)[0];
  assert.ok(returnType);
  assert.equal(returnType.kind, "attribute");
  assert.equal(returnType.slot.entity, "already-main");
  assert.equal(returnType.value, "int");
  const relationship = relationshipBindings(proposal)[0];
  assert.ok(relationship);
  assert.equal(relationship.kind, "relationship");
  assert.equal(relationship.object, "already-main");
});
