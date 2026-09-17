import type { AnalyzedKnowledgeDraft } from "../orchestration/post-output-knowledge-intake.js";

export const exampleClaim = "The sample box is blue.";
export const exampleMessage = `Hello. ${exampleClaim}`;
export const exampleDraft: AnalyzedKnowledgeDraft = {
  proposition: exampleClaim,
  kind: "fact",
  structuredProposition: {
    kind: "attribute_binding",
    entityLabel: "sample box",
    attribute: "colour",
    value: "blue",
  },
  tags: ["sample box", "colour"],
  domains: ["test fixtures"],
  entities: ["sample box"],
  severity: "minor",
};
// Serialize real objects so an illustrative output cannot teach JavaScript-like
// pseudocode in a strict JSON contract. Examples are fictional, never evidence.
export const analysisExamples = [
  {
    input: {
      message: "Hello, good evening. How are you?",
      answer: "Good evening! Happy to help.",
    },
    output: [],
  },
  {
    input: { message: exampleMessage, answer: "Understood." },
    output: [
      { ...exampleDraft, support: { source: "message", quote: exampleClaim } },
    ],
  },
  {
    input: { kind: "source", locator: "fixture.txt", content: exampleClaim },
    output: [
      { ...exampleDraft, support: { source: "source", quote: exampleClaim } },
    ],
  },
];
