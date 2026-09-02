import { randomUUID } from "node:crypto";
import { UNKNOWN_INSTANT } from "./clocks.js";
import { KnowledgeModelError } from "./errors.js";
import { asArtifactId, asEntityId } from "./ids.js";
import type { EntityRegistry, SlotRegistry } from "./registry.js";
import { slotKey } from "./registry.js";
import type {
  InterpretInput,
  InterpretProposal,
  KnowledgeIdFactory,
  ProposedArtifact,
  ProposedBinding,
  ProposedEntity,
  ProposedSlot,
  RelationSlotRef,
  SlotDefinition,
  UnresolvedReference,
} from "./types.js";

const SOURCE_CODE_CONFIDENCE = 1;
const SYMBOL_TYPE = "symbol";
const CONTAINS_RELATION = "contains";
const RETURN_TYPE_ATTRIBUTE = "return_type";

const FUNCTION_HEADER =
  /\b(?:(?:unsigned|signed|long|short|static|inline|extern|virtual|constexpr|const)\s+)*(int|void|bool|char|float|double|auto|size_t|wchar_t|unsigned|signed|long|short|[A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*\(([^;{}]*)\)/g;

const CALL_EXPRESSION = /\b([A-Za-z_]\w*)\s*\(/g;

const CALL_KEYWORDS = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "sizeof",
  "return",
  "alignof",
  "decltype",
  "static_cast",
  "dynamic_cast",
  "const_cast",
  "reinterpret_cast",
]);

export interface InterpretOptions {
  readonly entities: EntityRegistry;
  readonly slots: SlotRegistry;
  readonly idFactory?: KnowledgeIdFactory;
}

export function interpret(
  input: InterpretInput,
  options: InterpretOptions,
): InterpretProposal {
  validateInput(input);
  if (input.contentKind !== "source_code") {
    return emptyProposal();
  }
  return interpretSourceCode(input, options);
}

function interpretSourceCode(
  input: InterpretInput,
  options: InterpretOptions,
): InterpretProposal {
  const nextId = options.idFactory ?? randomUUID;
  const ingestedAt = input.ingestedAt ?? UNKNOWN_INSTANT;
  const locator = requireLocator(input.locator);
  const artifactId = asArtifactId(`A008_knowledge_artifact_${nextId()}`);
  const language = languageFromLocator(locator);

  const artifact: ProposedArtifact = {
    id: artifactId,
    contentKind: "source_code",
    locator,
    ingestedAt,
    language,
    confidence: SOURCE_CODE_CONFIDENCE,
  };

  const entities: ProposedEntity[] = [];
  const slots: ProposedSlot[] = [];
  const bindings: ProposedBinding[] = [];
  const unresolvedReferences: UnresolvedReference[] = [];
  const definedLabels = new Set<string>();
  const proposedSlotKeys = new Set<string>();

  proposeSlot(slots, proposedSlotKeys, options.slots, {
    ref: { kind: "relation", subject: artifactId, name: CONTAINS_RELATION },
    cardinality: "set",
    valueType: "referent",
  });

  const stripped = stripCommentsAndStrings(input.content);
  const functions = extractFunctions(stripped);

  for (const fn of functions) {
    const label = `${fn.name}()`;
    definedLabels.add(label);
    const resolved = resolveSymbol(options.entities, label);
    if (resolved.status === "ambiguous") {
      unresolvedReferences.push({
        label,
        role: "entity",
        reason: "entity resolution matched more than one symbol; no guess was made",
        confidence: 0,
      });
      continue;
    }

    const entityId =
      resolved.status === "resolved" ? resolved.entity.id : asEntityId(
        `A008_knowledge_entity_${nextId()}`,
      );
    if (resolved.status === "absent") {
      entities.push({
        id: entityId,
        type: SYMBOL_TYPE,
        labels: [label],
        confidence: SOURCE_CODE_CONFIDENCE,
      });
    }

    const relationSlot: RelationSlotRef = {
      kind: "relation",
      subject: artifactId,
      name: CONTAINS_RELATION,
      object: entityId,
    };
    bindings.push({
      kind: "relationship",
      slot: relationSlot,
      object: entityId,
      label: `${locator} --${CONTAINS_RELATION}--> ${label}`,
      confidence: SOURCE_CODE_CONFIDENCE,
    });

    proposeSlot(slots, proposedSlotKeys, options.slots, {
      ref: {
        kind: "attribute",
        entity: entityId,
        name: RETURN_TYPE_ATTRIBUTE,
      },
      cardinality: "single",
      valueType: "type_name",
    });
    bindings.push({
      kind: "attribute",
      slot: {
        kind: "attribute",
        entity: entityId,
        name: RETURN_TYPE_ATTRIBUTE,
      },
      value: fn.returnType,
      label: `${label}.${RETURN_TYPE_ATTRIBUTE} = ${fn.returnType}`,
      confidence: SOURCE_CODE_CONFIDENCE,
    });
  }

  for (const call of extractCalls(stripped, functions)) {
    const label = `${call}()`;
    if (definedLabels.has(label)) {
      continue;
    }
    const resolved = resolveSymbol(options.entities, label);
    if (resolved.status === "resolved") {
      bindings.push({
        kind: "relationship",
        slot: {
          kind: "relation",
          subject: artifactId,
          name: CONTAINS_RELATION,
          object: resolved.entity.id,
        },
        object: resolved.entity.id,
        label: `${locator} --${CONTAINS_RELATION}--> ${label}`,
        confidence: SOURCE_CODE_CONFIDENCE,
      });
      continue;
    }
    unresolvedReferences.push({
      label,
      role: "entity",
      reason:
        resolved.status === "ambiguous"
          ? "entity resolution matched more than one symbol; no guess was made"
          : "entity resolution found no matching symbol; no guess was made",
      confidence: 0,
    });
  }

  return {
    artifacts: [artifact],
    entities,
    slots,
    bindings,
    events: [],
    claims: [],
    unresolvedReferences,
  };
}

function proposeSlot(
  slots: ProposedSlot[],
  proposedSlotKeys: Set<string>,
  registry: SlotRegistry,
  definition: SlotDefinition,
): SlotDefinition {
  const key = slotKey(definition.ref);
  const existing = registry.get(definition.ref);
  const resolved = existing ?? definition;
  if (!proposedSlotKeys.has(key)) {
    proposedSlotKeys.add(key);
    slots.push({
      definition: resolved,
      confidence: SOURCE_CODE_CONFIDENCE,
    });
  }
  return resolved;
}

function resolveSymbol(
  entities: EntityRegistry,
  label: string,
): ReturnType<EntityRegistry["resolve"]> {
  return entities.resolve(label, SYMBOL_TYPE);
}

function requireLocator(locator: string | undefined): string {
  if (locator === undefined || locator.trim().length === 0) {
    throw new KnowledgeModelError(
      "invalid_input",
      "source_code INTERPRET requires a locator.",
    );
  }
  return locator.trim();
}

function validateInput(input: InterpretInput): void {
  if (input.contentKind.trim().length === 0) {
    throw new KnowledgeModelError("invalid_input", "contentKind must not be empty");
  }
  if (typeof input.content !== "string") {
    throw new KnowledgeModelError("invalid_input", "content must be a string");
  }
}

function emptyProposal(): InterpretProposal {
  return {
    artifacts: [],
    entities: [],
    slots: [],
    bindings: [],
    events: [],
    claims: [],
    unresolvedReferences: [],
  };
}

function languageFromLocator(locator: string): string | { readonly unknown: true } {
  const lower = locator.toLowerCase();
  if (
    lower.endsWith(".cpp") ||
    lower.endsWith(".cc") ||
    lower.endsWith(".cxx") ||
    lower.endsWith(".hpp") ||
    lower.endsWith(".hh") ||
    lower.endsWith(".hxx")
  ) {
    return "C++";
  }
  if (lower.endsWith(".c") || lower.endsWith(".h")) {
    return "C";
  }
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) {
    return "TypeScript";
  }
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs")) {
    return "JavaScript";
  }
  return UNKNOWN_INSTANT;
}

interface ExtractedFunction {
  readonly name: string;
  readonly returnType: string;
  readonly headerStart: number;
  readonly headerEnd: number;
}

function extractFunctions(content: string): ExtractedFunction[] {
  const functions: ExtractedFunction[] = [];
  FUNCTION_HEADER.lastIndex = 0;
  let match = FUNCTION_HEADER.exec(content);
  while (match !== null) {
    const returnType = match[1];
    const name = match[2];
    if (returnType !== undefined && name !== undefined && match[0] !== undefined) {
      functions.push({
        name,
        returnType,
        headerStart: match.index,
        headerEnd: match.index + match[0].length,
      });
    }
    match = FUNCTION_HEADER.exec(content);
  }
  return functions;
}

function extractCalls(
  content: string,
  functions: readonly ExtractedFunction[],
): readonly string[] {
  const definedNames = new Set(functions.map((fn) => fn.name));
  const bodies: string[] = [];
  for (const fn of functions) {
    const body = functionBody(content, fn.headerEnd);
    if (body !== undefined) {
      bodies.push(body);
    }
  }
  const search = bodies.length > 0 ? bodies.join("\n") : "";
  const calls: string[] = [];
  const seen = new Set<string>();
  CALL_EXPRESSION.lastIndex = 0;
  let match = CALL_EXPRESSION.exec(search);
  while (match !== null) {
    const name = match[1];
    if (
      name !== undefined &&
      !CALL_KEYWORDS.has(name) &&
      !definedNames.has(name) &&
      !seen.has(name)
    ) {
      seen.add(name);
      calls.push(name);
    }
    match = CALL_EXPRESSION.exec(search);
  }
  return calls;
}

function functionBody(content: string, headerEnd: number): string | undefined {
  const open = content.indexOf("{", headerEnd);
  if (open === -1) {
    return undefined;
  }
  let depth = 0;
  for (let index = open; index < content.length; index += 1) {
    const ch = content[index];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return content.slice(open + 1, index);
      }
    }
  }
  return content.slice(open + 1);
}

function stripCommentsAndStrings(content: string): string {
  let result = "";
  let index = 0;
  while (index < content.length) {
    const current = content[index];
    const next = content[index + 1];
    if (current === "/" && next === "/") {
      const end = content.indexOf("\n", index);
      index = end === -1 ? content.length : end;
      continue;
    }
    if (current === "/" && next === "*") {
      const end = content.indexOf("*/", index + 2);
      index = end === -1 ? content.length : end + 2;
      continue;
    }
    if (current === '"' || current === "'") {
      const quote = current;
      index += 1;
      while (index < content.length) {
        if (content[index] === "\\") {
          index += 2;
          continue;
        }
        if (content[index] === quote) {
          index += 1;
          break;
        }
        index += 1;
      }
      result += " ";
      continue;
    }
    result += current ?? "";
    index += 1;
  }
  return result;
}
