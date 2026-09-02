import { RequestError, type ContentBlock } from "@agentclientprotocol/sdk";

function resourceLinkText(
  block: Extract<ContentBlock, { type: "resource_link" }>,
): string {
  const label = block.title?.trim() || block.name.trim() || "linked resource";
  const description = block.description?.trim();
  return description === undefined || description.length === 0
    ? `[${label}](${block.uri})`
    : `[${label}](${block.uri})\n${description}`;
}

export function promptToText(blocks: readonly ContentBlock[]): string {
  const parts = blocks.map((block) => {
    if (block.type === "text") {
      return block.text;
    }
    if (block.type === "resource_link") {
      return resourceLinkText(block);
    }
    throw RequestError.invalidParams(
      { contentType: block.type },
      `a007 does not support ACP ${block.type} prompt content.`,
    );
  });

  const text = parts.join("\n\n").trim();
  if (text.length === 0) {
    throw RequestError.invalidParams(undefined, "ACP prompt must contain text.");
  }
  return text;
}
