# A008-0064 — Memory GUI verification

Task: A008-0064
Date: 2026-09-06
Status: Complete
Boundary: local synthetic data, actual SQLite and ACP; no live provider or private memory.

## Automated evidence

- `npm test`: 437 core cases, 4 repeated membership cases, 80 GUI cases;
  all passed, no skipped, failed or cancelled cases. All 52 core files are members.
- `npm run typecheck` and `npm --prefix gui run typecheck`: passed.
- `npm --prefix gui run build`: passed, 58 modules, 242.24 kB JavaScript and
  23.16 kB CSS before compression. No dependency added.
- `node --test dist/test/memory-inspection.test.js`: 8 passed. Tests cover
  defensive nonmutating SQLite reads, actual image provenance, dormant evidence,
  labels, unknown times, state/history separation, stable paging, graph bounds,
  parameter validation, full-text search beyond preview truncation, zero transport
  calls, runtime closure, older bridge availability, origin refusal and redaction.
- The HTTP proof starts the actual GUI host and actual ACP subprocess, inspects
  a previously written test record through `/v1/memory`, and supplies only a
  sentinel credential plus an unreachable loopback provider URL. No chat session
  is required. The secret sentinel is absent from the response.

## Browser evidence

The built GUI ran on isolated loopback hosts at ports 19864 (populated), 19865
(empty), and 19866 (older bridge without inspection). The temporary SQLite store
contained 152 synthetic inventory records: 8 entities, 16 current bindings,
8 historical bindings, 24 claims, 24 utterances, 24 artifacts, 48 provenance
records and no events. Lifecycle counts were 32 active, 16 dormant; one slot was
marked contested. Four stored domains each had 12 claim/utterance attachments.
No private memory file or `.env.local` was read.

Verified through the browser UI:

1. Memory Overview displays the exact counts above and labels the snapshot with
   project identity, durability and read time while chat remains disconnected.
2. Relationship map reports 80/152 nodes and 113/216 links with a visible cap.
   Keyboard Enter on the Atlas entity opens its stored details. Evidence activation
   is correctly absent for that entity. Selected neighbors and links are highlighted.
3. Search `Atlas` returns 19 records; Claims plus Dormant narrows to the one
   matching claim. The inspector shows `asserted` separately from `dormant`, actual
   source ID, domains, tags and stored attribution. Domain filtering works.
4. Clear filters and Next produce `41–80 of 152`. A missing search produces
   `0 of 0`, explicit empty-result copy and disabled pagination.
5. The filtered Atlas graph contains 19/19 records and 27/27 links. Zoom changes
   from 100% to 125%, and Reset returns to 100%.
6. A chat turn against the existing loopback fake provider rendered
   `Memory navigation keeps this conversation.` Its answer and an unsent draft
   survived switching to Memory and back. Thought remained a separate channel.
7. Empty storage shows zero counters and `Your memory store is empty`.
   The older bridge shows `Memory could not be read`, with no zero-counter
   substitution; Retry produces the same honest error while it remains unavailable.
8. At 390 × 844 the page width and viewport width both measured 390 pixels.
   Filters use two columns with full-width search; the table scrolls internally.
  Desktop verification used the default 1280 × 720 viewport. The temporary
   viewport override was reset. No error/warning logs appeared on the main test tab.

The three test tabs and all fixture hosts were closed after verification;
ports 19864–19866 were confirmed free. Synthetic SQLite files remain outside
the repository under the temporary evidence boundary.

Screenshots show synthetic evidence only:

- [Overview](A008-0064_memory-overview.png)
- [Filtered relationship graph and inspector](A008-0064_memory-graph.png)

## Practical limits

Inspection scans the current local namespace. The graph is a bounded diagnostic
view, not full graph export or similarity retrieval; links to transition-only
targets outside the inventory are omitted. Details are preview text at 16,000
characters, labels at 500; search still reads complete content. Changes arrive
on entry or Refresh, not live polling. Manual mutation and conflict resolution
are outside this task. No live NVIDIA run, packaging, push or deployment occurred.
