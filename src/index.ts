export { ChatSession } from "./core/chat-session.js";
export type {
  ChatSessionOptions,
  SendMessageOptions,
} from "./core/chat-session.js";
export { ChatError, isChatError } from "./core/errors.js";
export type { ChatErrorCode, ChatErrorOptions } from "./core/errors.js";
export {
  DEFAULT_MODEL_ID,
  ModelRegistry,
  NVIDIA_NEMOTRON_35_LIGHTNING,
  OPENAI_GPT_56_LUNA,
  defaultModelRegistry,
} from "./core/model-registry.js";
export type {
  ChatCallbacks,
  ChatCompletion,
  ChatDelta,
  ChatDeltaType,
  ChatExecutionEvidence,
  ChatGenerationOptions,
  ChatMessage,
  ChatRequest,
  ChatRole,
  ChatTransport,
  ChatUsage,
  ExecutionProvider,
  ModelProfile,
} from "./core/types.js";
export {
  acmeProviderHint,
  catalogExecutionProvider,
  resolveExecutionProvider,
} from "./core/execution-provider.js";
export {
  composeChatInvocation,
  serializeChatMessages,
  Utf8ByteChatMessageMeasurer,
} from "./core/chat-invocation.js";
export type {
  ChatInvocationBudget,
  ChatInvocationPlan,
  ChatMessageMeasurer,
  ComposedChatInvocation,
} from "./core/chat-invocation.js";
export {
  NVIDIA_CHAT_COMPLETIONS_URL,
  NvidiaChatTransport,
} from "./providers/nvidia/nvidia-chat-transport.js";
export type {
  FetchLike,
  NvidiaChatTransportOptions,
} from "./providers/nvidia/nvidia-chat-transport.js";
export {
  AcmeChatTransport,
  createAcmeChatTransport,
} from "./providers/acme/acme-chat-transport.js";
export type {
  AcmeChatTransportOptions,
  AcmeFetchLike,
} from "./providers/acme/acme-chat-transport.js";
export {
  ACME_MODEL_RUNTIME_COMPATIBILITY_PATH,
  ACME_MODEL_RUNTIME_EXECUTE_PATH,
  ACME_MODEL_RUNTIME_HEADER,
  ACME_MODEL_RUNTIME_PROTOCOL,
  AcmeChatError,
  isAcmeChatError,
} from "./providers/acme/acme-model-runtime.js";
export {
  OPENAI_CHAT_COMPLETIONS_URL,
  OpenAiChatTransport,
} from "./providers/openai/openai-chat-transport.js";
export type {
  OpenAiChatTransportOptions,
  OpenAiFetchLike,
} from "./providers/openai/openai-chat-transport.js";
export { parseSseData } from "./providers/nvidia/sse.js";
export {
  NvidiaReasoningNormalizer,
  splitLeakedContent,
  verifiedFinalAnswer,
} from "./providers/nvidia/reasoning-normalizer.js";
export {
  createNvidiaChatSession,
  createNvidiaChatTransport,
  createNvidiaTransportOptions,
  DEFAULT_SYSTEM_MESSAGE,
  NVIDIA_ENDPOINT_ENV,
} from "./runtime/nvidia-session.js";
export type { NvidiaSessionCompositionOptions } from "./runtime/nvidia-session.js";
export {
  createLocalMemoryRuntime,
  describeMemoryOutcome,
  formatRuntimeError,
  LIVE_PROJECTION_REINFORCEMENT,
  LIVE_RECONCILIATION_REINFORCEMENT,
  LOCAL_MEMORY_SCOPES,
  LocalMemoryRuntime,
  LocalMemorySession,
} from "./runtime/local-memory-runtime.js";
export type {
  LocalMemoryRuntimeOptions,
  LocalMemorySessionOptions,
  LocalMemoryTurnResult,
} from "./runtime/local-memory-runtime.js";
export {
  ACME_ENGINE_BUILD_ENV,
  ACME_MODEL_RUNTIME_TOKEN_ENV,
  ACME_MODEL_RUNTIME_URL_ENV,
  AGENT_ID_ENV,
  CHAT_TRANSPORT_ENV,
  DEBUG_TRACE_ENV,
  DEBUG_TRACE_FILE_ENV,
  defaultSqlitePath,
  parseDebugTraceMode,
  parseLocalRuntimeConfig,
  PROJECT_ID_ENV,
  PROJECT_ID_SIDECAR,
  SQLITE_PATH_ENV,
} from "./runtime/local-runtime-config.js";
export type {
  AcmeRuntimeSelection,
  ChatTransportMode,
  LocalRuntimeCliTraceOptions,
  LocalRuntimeConfig,
} from "./runtime/local-runtime-config.js";
export {
  createAcmeRuntimeChatTransport,
  createConfiguredChatTransport,
  createDispatchingChatTransport,
  usesAcmeChat,
} from "./runtime/chat-dispatch.js";
export {
  applyUserAssertionActivation,
  isExplicitUserAssertion,
} from "./runtime/user-assertion-gate.js";
export {
  createDebugTracer,
  DEFAULT_TRACE_EVENT_CHARS,
  DEFAULT_TRACE_FILE_BYTES,
  redactHeaders,
  redactSecrets,
  tracedChatTransport,
  tracedFetch,
} from "./runtime/debug-trace.js";
export type {
  DebugTraceEvent,
  DebugTraceMode,
  DebugTraceObserver,
  DebugTracePhase,
  DebugTraceSurface,
} from "./runtime/debug-trace.js";
export { A008AcpAgent } from "./acp/A008-acp-agent.js";
export type {
  A008AcpAgentOptions,
  AcpTurnSession,
} from "./acp/A008-acp-agent.js";
export { promptToText } from "./acp/prompt-content.js";
export { CodingAgentMemoryPolicy } from "./memory/coding-agent-policy.js";
export type { CodingAgentMemoryPolicyOptions } from "./memory/coding-agent-policy.js";
export { MemoryError, isMemoryError } from "./memory/errors.js";
export type { MemoryErrorCode } from "./memory/errors.js";
export { InMemoryMemoryRepository } from "./memory/in-memory-repository.js";
export {
  SqliteMemoryRepository,
} from "./memory/sqlite-memory-repository.js";
export type {
  SqliteMemoryRepositoryOptions,
} from "./memory/sqlite-memory-repository.js";
export {
  createSqliteKnowledgeContext,
  KnowledgeEngineCommit,
  KnowledgeMemoryReader,
  SqliteKnowledgeStore,
  sqliteKnowledgeTestProjectId,
} from "./memory/knowledge/index.js";
export type {
  KnowledgeEngineCommitOptions,
  KnowledgeMemoryReaderOptions,
  KnowledgeNamespaceSnapshot,
  SqliteKnowledgeContextHandle,
  SqliteKnowledgeContextOptions,
  SqliteKnowledgeStoreOptions,
} from "./memory/knowledge/index.js";
export { SemanticMemory } from "./memory/memory-engine.js";
export type { SemanticMemoryOptions } from "./memory/memory-engine.js";
export {
  DeterministicRetrievalPlanner,
} from "./memory/deterministic-retrieval-planner.js";
export type {
  DeterministicRetrievalPlannerOptions,
} from "./memory/deterministic-retrieval-planner.js";
export {
  NeutralHybridMemoryReadPolicy,
} from "./memory/hybrid-retrieval-policy.js";
export type {
  HybridMemoryReadPolicyOptions,
} from "./memory/hybrid-retrieval-policy.js";
export { HybridMemoryReader } from "./memory/hybrid-memory-reader.js";
export type {
  HybridMemoryReaderOptions,
} from "./memory/hybrid-memory-reader.js";
export {
  serializeContextProjection,
  Utf8ByteContextMeasurer,
} from "./memory/serialization.js";
export type {
  ActivationStatus,
  CanonicalStatus,
  ContextKnowledgeItem,
  ContextProjection,
  ExpectedKnowledgeRevision,
  KnowledgeIdFactory,
  KnowledgeItem,
  KnowledgeProposal,
  MemoryAuditEvent,
  MemoryAuditEventInput,
  MemoryAuditEventType,
  MemoryPolicy,
  MemoryReadView,
  MemoryRepository,
  MemoryTask,
  MemoryTransaction,
  ProjectionBudget,
  ProjectionResult,
  ProvenanceRef,
  ReconciliationDecision,
  ReconciliationGuard,
  ReconciliationRelation,
  ReconciliationResult,
  SerializedContextMeasurer,
} from "./memory/types.js";
export type {
  CandidateChannelHit,
  CandidateChannelLimits,
  CandidateScoreComponents,
  CandidateSearchResult,
  DialogueTurn,
  EmbeddingProvider,
  HybridMemoryReadPolicy,
  HybridMemoryReadResult,
  HybridRetrievalWeights,
  MemoryCandidateStore,
  MemoryReadEvidence,
  MemoryReadRequest,
  RankedMemoryCandidate,
  RetrievalChannel,
  RetrievalDocument,
  RetrievalIntent,
  RetrievalPlan,
  RetrievalPlanner,
  RetrievalTemporalHints,
  SemanticQueryVector,
  WeightedRetrievalLabel,
} from "./memory/retrieval-types.js";
export { IdentityError, isIdentityError } from "./identity/errors.js";
export type { IdentityErrorCode } from "./identity/errors.js";
export { InMemoryAcpIdentityBindingRepository } from "./identity/in-memory-binding-repository.js";
export {
  isRuntimeId,
  parseRuntimeId,
  RUNTIME_ID_VERSION,
  RUNTIME_IDENTITY_KINDS,
  RuntimeIdentityFactory,
  runtimeIdentityKind,
} from "./identity/runtime-id.js";
export type {
  AcpIdentityBinding,
  AcpIdentityBindingRepository,
  AcpSessionId,
  AgentId,
  AnyRuntimeId,
  ConversationId,
  ExternalIdentityReference,
  IdentityBindingRegistration,
  ProjectId,
  RuntimeId,
  RuntimeIdentityKind,
  RuntimeTaskId,
  UuidFactory,
} from "./identity/types.js";
export {
  DeterministicMemoryPromptComposer,
  MEMORY_CONTEXT_ENVELOPE_VERSION,
  MEMORY_CONTEXT_SYSTEM_INSTRUCTION,
} from "./orchestration/memory-prompt-composer.js";
export type {
  MemoryPrompt,
  MemoryPromptComposer,
} from "./orchestration/memory-prompt-composer.js";
export { MemoryAwareChatSession } from "./orchestration/memory-aware-chat-session.js";
export type {
  MemoryAwareChatSessionOptions,
  MemoryAwareSessionContext,
  MemoryAwareTurnInput,
  MemoryAwareTurnOptions,
  MemoryAwareTurnResult,
  MemoryReadPort,
} from "./orchestration/memory-aware-chat-session.js";
export {
  parseProposalConfidence,
  PostOutputKnowledgeIntake,
  serializeStagedKnowledgeProposals,
  Utf8ByteKnowledgeIntakeMeasurer,
} from "./orchestration/post-output-knowledge-intake.js";
export { IndexedRelationCandidateSource } from "./orchestration/relation-candidate-source.js";
export type {
  IndexedRelationCandidateSourceOptions,
  RelationCandidate,
  RelationCandidateRequest,
  RelationCandidateSource,
} from "./orchestration/relation-candidate-source.js";
export {
  RelationGatedMemoryCommit,
  serializeRelationClassifierInput,
} from "./orchestration/relation-gated-memory-commit.js";
export type {
  KnowledgeRelationClassifier,
  NotRequiredRelationIndex,
  PendingRelationIndexRepair,
  RelationClassifierBudget,
  RelationClassifierCandidate,
  RelationClassifierDecision,
  RelationClassifierInput,
  RelationClassifierProposal,
  RelationCommitEvidence,
  RelationCommitInput,
  RelationGatedCommitResult,
  RelationGatedMemoryCommitOptions,
  RelationIndexResult,
  RelationIndexWriter,
  RelationMemoryPort,
  UpdatedRelationIndex,
} from "./orchestration/relation-gated-memory-commit.js";
export type {
  AnalyzedKnowledgeDraft,
  KnowledgeIntakeBudget,
  KnowledgeIntakeMeasurer,
  PostOutputAnalyzerInput,
  PostOutputKnowledgeAnalyzer,
  PostOutputKnowledgeIntakeContext,
  PostOutputKnowledgeIntakeLimits,
  PostOutputKnowledgeIntakeOptions,
  StagePostOutputKnowledgeInput,
  StagedKnowledgeBatch,
  StagedKnowledgeProposal,
} from "./orchestration/post-output-knowledge-intake.js";
export { PostOutputMemoryCoordinator } from "./orchestration/post-output-memory-coordinator.js";
export type {
  CommitFailedPostOutputMemoryResult,
  CompletedPostOutputMemoryResult,
  IndexRepairRequiredPostOutputMemoryResult,
  PostOutputKnowledgeStager,
  PostOutputMemoryCommitCheckpoint,
  PostOutputMemoryCommitRecord,
  PostOutputMemoryCoordinatorOptions,
  PostOutputMemoryIndexRepairCheckpoint,
  PostOutputMemoryResult,
  StagedProposalCommitter,
  StagingFailedPostOutputMemoryResult,
} from "./orchestration/post-output-memory-coordinator.js";
export type { SemanticOperationContext } from "./orchestration/semantic-operation.js";
export {
  ChatTransportSemanticJsonGenerator,
  KNOWLEDGE_RELATION_CLASSIFIER_INSTRUCTION,
  ModelBackedKnowledgeRelationClassifier,
  ModelBackedPostOutputKnowledgeAnalyzer,
  POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION,
  serializeSemanticJsonRequest,
  SEMANTIC_JSON_GENERATION,
} from "./orchestration/semantic-json-model.js";
export type {
  ChatTransportSemanticJsonGeneratorOptions,
  SemanticJsonGenerateInput,
  SemanticJsonGenerator,
  SemanticJsonOperation,
} from "./orchestration/semantic-json-model.js";
