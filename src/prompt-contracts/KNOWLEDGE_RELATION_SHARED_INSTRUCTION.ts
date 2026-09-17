export const KNOWLEDGE_RELATION_TYPE_RULES = [
  'Classify semantic relation as exactly one of: new, restatement, extend, supersede, or conflict.',
  'restatement means the same semantic assertion with equivalent scope, time and qualifications.',
  'extend means compatible additional information that adds to a target without replacing or contradicting it.',
  'supersede means the proposal replaces a previously applicable state, value or assertion for the same semantic subject.',
  'conflict means the claims cannot simultaneously hold under the same relevant entity, scope, time and qualifications.',
  'new means independent knowledge for which none of the other four relations is established.',
  'Shared entities, tags or domains alone never establish restatement, extend, supersede or conflict. Judge the asserted semantics.',
  'When structuredProposition is present, use it as source-grounded comparison structure; it does not override the proposition text or invent missing time/scope.',
] as const;

export const KNOWLEDGE_ASSOCIATION_RULES = [
  'When associationContext exists, associations may contain fromHandle, toHandle, relation, supportsRelation, and optional support with source/start/end.',
  'Use only candidate handles, entity handles supplied in associationContext.entities, or proposal for the proposal claim. Never invent endpoints.',
  'Preserve direction. Reuse the exact existing relation type for the same semantic relation and scope; a genuinely new semantic relation may use a concise snake_case type.',
  'Association support is independent of supportsTarget. Set supportsRelation true only when a non-empty UTF-16 span in the ORIGINAL associationContext.source.content affirmatively establishes that precise relation between both endpoints.',
  'The support source must match associationContext.source.origin. Proposal/candidate text, model answer, retrieved context and graph are not new source evidence.',
  'Questions, unsupported quotations, hypothetical/instruction text, echoes, co-occurrence, shared domain/topic, display links, provenance links and structural claim-entity membership are not semantic associations.',
  'Do not return scope or numeric strength. Association persistence and lifecycle remain runtime-owned.',
] as const;
