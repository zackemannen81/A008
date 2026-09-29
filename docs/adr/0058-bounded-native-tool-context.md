# ADR 0058 — Bounded native tool context

Status: Accepted
Date: 2026-09-30
Decision owner: Rickard (request to optimize tool context and avoid whole-file reads)
Task: A008-0200

## Authority and decision

PC-LF-01/03/04/06 place local tools, context construction and tool permissions
in A008 and keep execution in the selected workspace. The owner's explicit
request permits changing native tools to avoid unnecessary model context.

Native read_file returns a line section by default, with the whole-file SHA-256
computed from the same local snapshot. It reports zero-based offset, returned
line count, total line count, next_offset and complete. Defaults are 200 lines
and 8192 bytes of serialized result text, further bounded by runtime limits.
The content remains exact UTF-8 text including its original BOM/line endings;
no line prefixes or implicit partial lines are inserted. A line that cannot
fit produces an actionable failure rather than an unmarked partial result.

Local text processing has a separate 16 MiB ceiling. Small approved edits may
therefore change files larger than the model's tool-result budget. Whole-file
revision and unique-match checks remain mandatory. Uniform LF/CRLF files accept
either LF or CRLF arguments, normalized to the file's line ending; mixed endings
retain literal matching. No fuzzy writes are introduced. Successful create/edit
results expose the next hash without echoing contents, allowing successive edits
without an intervening read. A concurrent writer can still race the final write;
this is not a filesystem compare-and-swap transaction.

exec_command and git also default to 8192 result-text bytes and accept an explicit
max_output_bytes under the runtime ceiling. Tool descriptions favor sectional
native inspection/editing, scoped Git/rg output and targeted tests, reserving MCP
for capabilities such as structured documents and interactive processes.
This is guidance, not automatic routing or a guarantee of model choices.

## Compatibility and consequences

Tool names and existing required arguments remain. Small path-only reads still
return full contents; larger path-only reads are now explicit pages. Consumers
must inspect complete/next_offset and must not treat a page as an entire file.
Hashes across separately read pages must agree before assuming one revision.
The model-visible byte limit does not avoid reading/hashing the local file.
Very long single lines and files above 16 MiB need explicit alternative tools.
File-wide newline conversion is not a native edit_file feature.

Approvals, workspace checks, MCP access, evidence paths, history, memory and
provider strict mode remain unchanged. Enabled MCP definitions still occupy
context; this task does not silently disable or lazily discover tools. No third-
party implementation was copied. Verification measures local fixture bytes;
live-provider token savings and fewer model retries are not established.
