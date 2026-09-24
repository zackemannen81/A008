# Decision Records

Top-level ADR files in this directory are accepted current decisions that still refine the product contract or implemented system.

## Authority rule

- `docs/PROJECT_BRIEF.md` owns product direction and the Core Product Contract.
- Accepted top-level ADRs may refine a bounded product or implementation decision.
- `docs/CURRENT_STATUS.md` owns observed current reality.
- `docs/SYSTEMDOC.md` owns durable behavior that actually exists.
- `docs/adr/_legacy/` contains retired historical decisions for provenance only and is never current authority.
- Historical task, journal, handoff, or legacy text cannot override a current owner.

When an ADR no longer represents a current durable decision, move it to `_legacy/` rather than leaving stale authority in the active set.
