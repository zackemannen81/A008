# ADR 0062 — OpenAI API calls.

Status: Accepted
Date: 2026-10-01
Decision owner: Rickard
Task: none

OpenAI’s Responses API is superior to the older Chat Completions API because it is designed for modern, agent-based AI workflows and built-in tools, rather than simple conversations.

Key benefits of the Responses API:
• Agent focus and built-in tools: Features native support for server-side tools—such as web search, file encryption, code interpretation, and MCP (Model Context Protocol) servers—directly within the same loop.
• Simplified state management: Uses `previous_response_id` to track conversations, eliminating the manual, resource-intensive task of passing the entire message history with every call.
• Improved performance and caching: Delivers up to 40–80% better cache utilization and lower latency when running advanced reasoning models.
• Reasoning security: Hides and encrypts the model’s internal chain-of-thought processes from the client, thereby reducing risks and protecting against unexpected behavior.

If responses API is supported by a model, it should always be the first and only choice unless a task specificly requires chat completions.
