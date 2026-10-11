const { z } = require('zod');

const OutputTextPartSchema = z.object({
    type: z.literal('output_text'),
    text: z.string(),
});
const OutputFunctionCallSchema = z.object({
    type: z.literal('function_call'),
    id: z.string().min(1).optional(),
    call_id: z.string().min(1).optional(),
    name: z.string().min(1),
    arguments: z.string(),
});
const OutputItemSchema = z.union([OutputTextPartSchema, OutputFunctionCallSchema]);

const UsageSchema = z.object({
    input_tokens: z.number().int().nonnegative().optional(),
    output_tokens: z.number().int().nonnegative().optional(),
    total_tokens: z.number().int().nonnegative().optional(),
});

const OpenAiResponseSchema = z.object({
    id: z.string().min(1),
    model: z.string().min(1),
    status: z.string().min(1),
    incomplete_details: z.object({ reason: z.string().optional() }).nullish(),
    error: z
        .object({ code: z.string().nullish(), message: z.string().optional() })
        .nullish(),
    output: z.array(OutputItemSchema).default([]),
    usage: UsageSchema.optional(),
});

const mockMapped = {
  id: "kie-mapped",
  model: "gpt-6-luna",
  status: "completed",
  output: [
    {
      type: "output_text",
      text: "{}"
    }
  ],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 200,
    total_tokens: 300
  }
};

const result = OpenAiResponseSchema.safeParse(mockMapped);
if (!result.success) {
  console.log("FAILED:");
  console.log(result.error);
} else {
  console.log("SUCCESS!");
}
