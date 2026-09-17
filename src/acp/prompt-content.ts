import { RequestError, type ContentBlock } from "@agentclientprotocol/sdk";

export interface PromptImageLocator {
  readonly locator: string;
  readonly declaredMediaType?: string;
}
export interface PromptTurnInput {
  readonly text: string;
  readonly image?: PromptImageLocator;
}

function resourceLinkText(
  block: Extract<ContentBlock, { type: "resource_link" }>,
): string {
  const label = block.title?.trim() || block.name.trim() || "linked resource";
  const description = block.description?.trim();
  return description === undefined || description.length === 0
    ? `[${label}](${block.uri})`
    : `[${label}](${block.uri})\n${description}`;
}

export function promptToTurnInput(
  blocks: readonly ContentBlock[],
): PromptTurnInput {
  const parts: string[] = [];
  let image: PromptImageLocator | undefined;
  for (const block of blocks) {
    if (block.type === "text") {
      parts.push(block.text);
      continue;
    }
    if (block.type === "resource_link") {
      const mediaType = block.mimeType?.trim();
      if (block.uri.startsWith("source:") && mediaType?.startsWith("image/")) {
        if (image !== undefined) {
          throw RequestError.invalidParams(
            undefined,
            "A008 accepts one native image attachment per turn.",
          );
        }
        image = { locator: block.uri, declaredMediaType: mediaType };
        continue;
      }
      parts.push(resourceLinkText(block));
      continue;
    }
    throw RequestError.invalidParams(
      { contentType: block.type },
      `A008 does not support ACP ${block.type} prompt content.`,
    );
  }
  const text = parts.join("\n\n").trim();
  if (text.length === 0) {
    throw RequestError.invalidParams(
      undefined,
      "ACP prompt must contain text.",
    );
  }
  return { text, ...(image === undefined ? {} : { image }) };
}

export function promptToText(blocks: readonly ContentBlock[]): string {
  return promptToTurnInput(blocks).text;
}
