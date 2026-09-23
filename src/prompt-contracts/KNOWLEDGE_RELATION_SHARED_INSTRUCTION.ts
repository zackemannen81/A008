export const KNOWLEDGE_RELATION_TYPE_RULES = [
  "Classify semantic relation as exactly one of: new, restatement, extend, supersede, or conflict.",
  "Compare the proposal's meaning with the supplied candidates. Tags, domains, retrieval rank, authority, confidence, provenance and lifecycle state do not determine semantic relation.",
  "restatement means the same semantic assertion with equivalent entity/relationship, value, polarity, scope, relevant time and material qualifications.",
  "extend means compatible additional knowledge that can coexist with the target and does not replace the value at the same semantic address.",
  "supersede means an updated or corrected value for the SAME semantic address. supersede is forbidden when semantic addresses differ.",
  "conflict means materially incompatible assertions for the SAME semantic address, relevant scope and time when neither assertion establishes a directed update/correction.",
  "new means no supplied candidate has any of the four relations above.",
  "When both sides carry structuredProposition, use it to resolve semantic identity before comparing prose.",
  "For attribute_binding, semantic identity is the entityLabel + attribute slot. Same slot and same value strongly indicates restatement; same slot and changed applicable value may be supersede or conflict.",
  "Different attribute slots are different semantic addresses: never classify them as restatement, supersede or conflict merely because their prose is related.",
  "For relationship_binding, identity is subjectLabel + relation + objectLabel. Preserve direction.",
  "The classifier does not choose Current State or History. It does not decide canonical IDs, commit order, lifecycle strength, activation, decay, attraction or final state ownership. Runtime commit owns those operations.",
] as const;

export const KNOWLEDGE_ASSOCIATION_RULES = [
  "When associationContext exists, emit associations only for semantic relationships explicitly established by the ORIGINAL associationContext.source.content.",
  "Use only candidate handles, supplied entity handles, or proposal as endpoints. Never invent endpoints.",
  "Reuse an existing relation type when the same directed semantic relationship is already represented; otherwise use a concise snake_case relation.",
  "Set supportsRelation true only when a non-empty exact source span affirmatively establishes that precise directed relation between both endpoints.",
  "Proposal text, retrieved context, graph adjacency, shared tags/domains, co-occurrence, display links and provenance links are not new source evidence.",
  "Do not output attraction or numeric strength. Runtime owns association persistence and lifecycle.",
] as const;
