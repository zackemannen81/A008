// Default: print the exact synthetic request set without reading a key/calling a provider.
// Live: requires explicit task authority, --live and --model <registered NVIDIA model>.
// Build first. The existing stateless generator/transport/stager own all processing.
import { parseArgs } from "node:util";
import { defaultModelRegistry } from "../dist/src/core/model-registry.js";
import { generationCapabilities } from "../dist/src/core/generation-controls.js";
import { Utf8ByteChatMessageMeasurer } from "../dist/src/core/chat-invocation.js";
import { parseRuntimeId } from "../dist/src/identity/runtime-id.js";
import { NvidiaChatTransport } from "../dist/src/providers/nvidia/nvidia-chat-transport.js";
import { ChatTransportSemanticJsonGenerator, ModelBackedPostOutputKnowledgeAnalyzer, SEMANTIC_JSON_GENERATION } from "../dist/src/orchestration/semantic-json-model.js";
import { PostOutputKnowledgeIntake, Utf8ByteKnowledgeIntakeMeasurer } from "../dist/src/orchestration/post-output-knowledge-intake.js";

const { values } = parseArgs({ options: { live: { type: "boolean", default: false }, model: { type: "string" } } });
if (!values.model) throw new Error("Specify --model; the check never silently switches models.");
const model = defaultModelRegistry.require(values.model).id;
const caps = generationCapabilities(model);
const generation = { ...SEMANTIC_JSON_GENERATION, ...(caps.topP ? {} : { topP: null }), maxTokens: Math.min(16384, caps.maxTokens) };
const cases = [
  { id: "greeting", input: { message: "Hej, hur mår du?", answer: "Hej! Jag är redo att hjälpa till." }, expected: "Empty array; no social-exchange proposal." },
  { id: "mixed", input: { message: "Hej! Jag föredrar svar på svenska.", answer: "Tack, då svarar jag på svenska." }, expected: "One language-preference claim, supported by the original message; no greeting proposal." },
  { id: "source", input: { kind: "source", locator: "synthetic-fixture.txt", content: "The fixture service stores records in SQLite." }, expected: "One SQLite storage claim, with source support." },
];
if (!values.live) {
  console.log(JSON.stringify({ mode: "dry-run", model, endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maximumCalls: cases.length, retries: 0, perCallTimeoutMs: 180000, generation,
    instruction: "POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION in src/orchestration/semantic-json-model.ts",
    requests: cases }, null, 2));
} else {
  const key = process.env.NVIDIA_API_KEY?.trim();
  if (!key) throw new Error("NVIDIA_API_KEY is required; use the existing environment, never a command-line key.");
  const transport = new NvidiaChatTransport({ apiKey: key, timeoutMs: 180000 });
  let providerCalls = 0;
  const analyzer = new ModelBackedPostOutputKnowledgeAnalyzer(new ChatTransportSemanticJsonGenerator({
    transport: { async complete(request) { providerCalls += 1; return transport.complete(request); } }, model, generation,
    budget: { maximum: 262144, measurer: new Utf8ByteChatMessageMeasurer() },
  }));
  const identity = kind => parseRuntimeId(`A008_v1_${kind}_85000000-0000-4000-8000-000000000001`, kind);
  const intake = new PostOutputKnowledgeIntake({ analyzer,
    context: { projectId: identity("project"), conversationId: identity("conversation"), agentId: identity("agent") },
    budget: { maximum: 262144, measurer: new Utf8ByteKnowledgeIntakeMeasurer() },
  });
  const results = [];
  for (const fixture of cases) {
    try {
      const result = await intake.stage({ ...fixture.input, taskId: identity("task"), applicabilityScopes: ["synthetic-check"],
        ...(fixture.input.kind === "source" ? { utteranceId: "synthetic-source-utterance" } : {}) });
      const proposals = result.proposals;
      const content = fixture.input.content ?? fixture.input.message;
      const supported = proposals.every(p => p.support && p.support.end > p.support.start &&
        p.support.start >= 0 && p.support.end <= content.length && p.support.source === (fixture.input.kind === "source" ? "source" : "message"));
      // This is a bounded semantic smoke check of known synthetic facts, not a
      // general language-quality score or proof of future compliance.
      const meaning = fixture.id === "greeting" ? proposals.length === 0 :
        proposals.length === 1 && (fixture.id === "mixed" ? /svensk|swedish/iu : /sqlite/iu).test(proposals[0].proposal.proposition);
      const passed = result.skippedProposals.length === 0 && supported && meaning;
      const summary = { case: fixture.id, strictJson: true, admittedProposals: proposals.length,
        skipped: result.skippedProposals.length, sourceSpansValid: supported, expectedMeaning: meaning, passed,
        // Only synthetic results, for human semantic review; never persist raw
        // completions or reasoning in repository evidence.
        claims: proposals.map(p => ({ proposition: p.proposal.proposition, support: p.support })) };
      results.push(summary);
      console.log(JSON.stringify(summary));
    } catch (error) {
      const summary = { case: fixture.id, passed: false, errorCode: error.code ?? "error", message: String(error.message).slice(0, 600) };
      results.push(summary);
      console.log(JSON.stringify(summary));
      if (["authentication", "rate_limit", "provider", "server", "timeout", "network"].includes(error.code)) break;
    }
  }
  const passed = results.length === cases.length && results.every(result => result.passed);
  console.log(JSON.stringify({ model, providerCalls, passed, databaseWrites: 0, retries: 0 }));
  if (!passed) process.exitCode = 1;
}
