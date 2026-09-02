# Integration Handoffs

Discoverability: naming convention `A008-NNNN.md`.
Member state: required. Every member declares a `Status:` line.

A writing worker writes one handoff when it opens a pull request. The
operator treats repository state plus this file as integration evidence.
Worker transcripts are not authority.

## Required fields

- Task ID and branch
- Head commit SHA
- Pull request URL
- Files changed
- Exact verification commands and results
- Skipped gates and reasons
- Blockers
- Next recommended operator action

## Records

- [A008-0023](A008-0023.md) — M1 direct-match eligibility repair; PR open.
