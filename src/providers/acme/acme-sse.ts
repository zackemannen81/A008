export interface AcmeSseEvent {
  readonly event: string | undefined;
  readonly data: string;
}

function parsedBlock(block: string): AcmeSseEvent | undefined {
  let event: string | undefined;
  const data: string[] = [];
  for (const rawLine of block.split(/\r?\n/u)) {
    if (rawLine.length === 0 || rawLine.startsWith(":")) {
      continue;
    }
    const colon = rawLine.indexOf(":");
    const field = colon === -1 ? rawLine : rawLine.slice(0, colon);
    const value =
      colon === -1
        ? ""
        : rawLine.slice(colon + 1).startsWith(" ")
          ? rawLine.slice(colon + 2)
          : rawLine.slice(colon + 1);
    if (field === "event") {
      event = value;
    } else if (field === "data") {
      data.push(value);
    }
  }
  if (data.length === 0) {
    return undefined;
  }
  return { event, data: data.join("\n") };
}

export async function* parseAcmeSseEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<AcmeSseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const boundary = /\r?\n\r?\n/u.exec(buffer);
        if (boundary === null || boundary.index === undefined) {
          break;
        }
        const block = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const parsed = parsedBlock(block);
        if (parsed !== undefined) {
          yield parsed;
        }
      }
    }
    const trailing = parsedBlock(buffer);
    if (trailing !== undefined) {
      yield trailing;
    }
  } finally {
    reader.releaseLock();
  }
}
