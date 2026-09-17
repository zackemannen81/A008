import { createServer } from "node:http";
import { once } from "node:events";

/** Loopback-only provider for session-control proof; payloads are synthetic. */
export async function startSessionControlProvider(
  chatReply?: (
    payload: Record<string, any>,
  ) => Record<string, unknown> | undefined,
) {
  const requests: Record<string, any>[] = [];
  const server = createServer(async (request, response) => {
    let text = "";
    for await (const chunk of request) text += String(chunk);
    const payload = JSON.parse(text) as Record<string, any>;
    requests.push(payload);
    const last = payload.messages?.at(-1)?.content ?? "";
    let operation: string | undefined;
    try {
      operation = JSON.parse(last).operation;
    } catch {
      /* chat text */
    }
    if (operation !== undefined) {
      const result =
        operation === "knowledge_analysis"
          ? []
          : operation === "relation_classification"
            ? { type: "new" }
            : { domains: [], relatedDomains: [] };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [
            {
              message: { role: "assistant", content: JSON.stringify(result) },
              finish_reason: "stop",
            },
          ],
        }),
      );
      return;
    }
    if (last.includes("FAIL-TURN")) {
      response
        .writeHead(500)
        .end(JSON.stringify({ error: "synthetic failure" }));
      return;
    }
    if (last.includes("WAIT-TURN")) {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "Waiting in fixture." } }] })}\n\n`,
      );
      return; // Disconnected by cancellation; no timer or provider spend.
    }
    const message = chatReply?.(payload) ?? {
      role: "assistant",
      content: `Fixture answer ${requests.filter((p) => !String(p.messages?.at(-1)?.content).includes('"operation"')).length}.`,
      reasoning_content: "Display-only fixture thought.",
    };
    if (payload.stream === false) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [{ message, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      );
    } else {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: message.reasoning_content } }] })}\n\n`,
      );
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                content: message.content,
                ...(Array.isArray(message.tool_calls)
                  ? {
                      tool_calls: message.tool_calls.map((call, index) => ({
                        ...call,
                        index,
                      })),
                    }
                  : {}),
              },
              finish_reason: message.tool_calls ? "tool_calls" : "stop",
            },
          ],
        })}\n\n`,
      );
      response.end("data: [DONE]\n\n");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture failed to bind.");
  return {
    requests,
    endpoint: `http://127.0.0.1:${address.port}/v1/chat/completions`,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
