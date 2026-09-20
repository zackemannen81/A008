import type {
  ChatContent,
  ChatGeneratedImageContentPart,
  ChatMessage,
} from "./types.js";

export function cloneChatMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    content:
      typeof message.content === "string"
        ? message.content
        : message.content.map((part) => ({ ...part })),
  };
}

export function generatedImageLabel(
  part: ChatGeneratedImageContentPart,
): string {
  switch (part.status) {
    case "pending":
      return `[IMAGE GENERATING] ${part.prompt}`;
    case "completed":
      return `[IMAGE] ${part.prompt}`;
    case "failed":
      return `[IMAGE GENERATION FAILED] ${part.prompt}`;
    case "cancelled":
      return `[IMAGE GENERATION CANCELLED] ${part.prompt}`;
  }
}

/** Text parts only. Image parts stay out of memory/utterance extraction. */
export function chatContentText(content: ChatContent): string {
  if (typeof content === "string") return content;
  return content
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");
}

/** Provider/CLI projection: text plus bounded image labels, never locators/URLs. */
export function chatContentDisplay(content: ChatContent): string {
  if (typeof content === "string") return content;
  return content
    .map((part) =>
      part.type === "text" ? part.text : generatedImageLabel(part),
    )
    .filter((part) => part.length > 0)
    .join("\n");
}

export function generatedImagePart(
  content: ChatContent | undefined,
): ChatGeneratedImageContentPart | undefined {
  if (content === undefined || typeof content === "string") return undefined;
  const images = content.filter(
    (part): part is ChatGeneratedImageContentPart =>
      part.type === "generated_image",
  );
  return images.length === 1 ? images[0] : undefined;
}

export function generatedImageMessage(
  generationId: string,
  prompt: string,
): ChatMessage {
  const id = generationId.trim();
  const description = prompt.trim();
  if (!id || !description) {
    throw new Error("Generated image identity and prompt must be non-empty.");
  }
  return {
    role: "assistant",
    content: [
      {
        type: "generated_image",
        generationId: id,
        prompt: description,
        status: "pending",
      },
    ],
  };
}

export type GeneratedImageTerminalUpdate =
  | {
      readonly status: "completed";
      readonly locator: string;
      readonly mediaType: string;
      readonly filename: string;
    }
  | { readonly status: "failed" | "cancelled"; readonly error?: string };

export function updateGeneratedImageMessage(
  message: ChatMessage,
  generationId: string,
  update: GeneratedImageTerminalUpdate,
): ChatMessage {
  if (typeof message.content === "string") return message;
  let changed = false;
  const content = message.content.map((part) => {
    if (
      part.type !== "generated_image" ||
      part.generationId !== generationId
    ) {
      return part;
    }
    changed = true;
    if (update.status === "completed") {
      return {
        type: "generated_image" as const,
        generationId: part.generationId,
        prompt: part.prompt,
        status: "completed" as const,
        locator: update.locator,
        mediaType: update.mediaType,
        filename: update.filename,
      };
    }

    return {
      type: "generated_image" as const,
      generationId: part.generationId,
      prompt: part.prompt,
      status: update.status,
      ...(update.error ? { error: update.error } : {}),
    };
  });
  return changed ? { ...message, content } : message;
}

export function sameCommittedMessageIdentity(
  left: Pick<ChatMessage, "role" | "content">,
  right: Pick<ChatMessage, "role" | "content">,
): boolean {
  if (left.role !== right.role) return false;
  if (
    typeof left.content === "string" &&
    typeof right.content === "string"
  ) {
    return left.content === right.content;
  }
  const leftImage = generatedImagePart(left.content);
  const rightImage = generatedImagePart(right.content);
  if (leftImage && rightImage) {
    return leftImage.generationId === rightImage.generationId;
  }
  return JSON.stringify(left.content) === JSON.stringify(right.content);
}
