function eventData(event: string): string | undefined {
  const data = event
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /u, ""));

  return data.length === 0 ? undefined : data.join("\n");
}

export async function* parseSseData(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
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

        const event = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = eventData(event);
        if (data !== undefined) {
          yield data;
        }
      }
    }

    const trailing = eventData(buffer);
    if (trailing !== undefined) {
      yield trailing;
    }
  } finally {
    reader.releaseLock();
  }
}
