/** A008-owned docs-first starter files. Adapted from the Docs-First Continuity
 * Protocol Apache-2.0 templates at c1b7b44309095d30262d273d8f5d0704629a943c.
 * Copied files remain Apache-2.0; the created project's own work is not
 * relicensed by this starter. */

export function docsFirstFiles(input: {
  readonly projectName: string;
  readonly taskPrefix: string;
}): Readonly<Record<string, string>> {
  const { projectName, taskPrefix } = input;
  return {
    "AGENTS.md": `# AGENTS.md

This repository is docs-first. Every task begins in \`docs/CURRENT_TASK.md\`.

## Project Identity

- Working project name: ${projectName}
- Task identity prefix: \`${taskPrefix}\`

## Start Here

1. \`docs/CURRENT_TASK.md\`
2. \`docs/TASK_WORKFLOW.md\`
3. \`docs/PROJECT_BRIEF.md\`
4. \`docs/CURRENT_STATUS.md\`
5. \`docs/SYSTEMDOC.md\`
6. \`docs/JOURNAL.md\`
7. \`docs/FILESTRUCTURE.md\`
`,
    "docs/template_CURRENT_TASK.md": `# Current Task

Task ID:
Parent Task: None
Status: Draft
Owner:
Created:
Last updated:
Charter frozen at:

## Task Summary

Describe why this bounded task is active now and its intended outcome.

## Task Charter

### Goal

Define one primary outcome.

### Primary Deliverable

Name the concrete artifact or behavior.

### In Scope

- List work required for the deliverable.

### Out of Scope

- List adjacent work that must not be absorbed.

### Definition of Done

- State objective completion conditions.

### Minimum Verification Gates

- [ ] Define checks that may be strengthened but not removed after Ready.
`,
    "docs/CURRENT_TASK.md": `# Current Task

Task ID:
Parent Task: None
Status: Draft
Owner:
Created:
Last updated:
Charter frozen at:

## Task Summary

Describe why this bounded task is active now and its intended outcome.
`,
    "docs/TASK_WORKFLOW.md": `# Task Workflow

Draft -> Ready -> In Progress -> Complete

Ready freezes goal, primary deliverable, scope, out-of-scope, definition of
done, and minimum verification gates. Claim the next identity in
\`docs/TASK_IDS.md\` on the default branch before Ready.
`,
    "docs/TASK_IDS.md": `# Task ID Register

Floor: ${taskPrefix}-0001

| Task ID | Title | Owner | Claimed | Work |
| --- | --- | --- | --- | --- |
`,
    "docs/PROJECT_BRIEF.md": `# Project Brief

Status: Draft product direction.

## Purpose

${projectName}
`,
    "docs/CURRENT_STATUS.md": `# Current Status

Reality as of bootstrap. This document records observed state.

## What exists

The docs-first starter files for ${projectName} were created by A008 project bootstrap.
`,
    "docs/SYSTEMDOC.md": `# System Document

Durable behavior that actually exists for ${projectName}.
`,
    "docs/JOURNAL.md": `# Journal

Newest first. Append only.

## Bootstrap

- Created by A008 project bootstrap.
`,
    "docs/FILESTRUCTURE.md": `# File Structure

- \`AGENTS.md\` — entry point
- \`docs/\` — docs-first control plane
`,
    "docs/CONTRIBUTING.md": `# Contributing

Read \`AGENTS.md\` and its ordered authority list before changing the repository.
`,
    "docs/adr/README.md": `# Decision Records

Discoverability: index. Every member is listed below.

## Records

- none yet
`,
    "docs/backlog/README.md": `# Backlog

In-scope work that is not active.
`,
    "docs/concepts_sandbox/README.md": `# Concepts Sandbox

Non-authoritative ideas. No task may cite this folder as authority.
`,
    "docs/finished/README.md": `# Finished Tasks

Archived completed tasks. Immutable.
`,
    "docs/paused/README.md": `# Paused Tasks

Frozen parent tasks awaiting a resume condition.
`,
  };
}

export function multiAgentPolicy(input: {
  readonly maxWorkers: number;
  readonly workerCloneRoot: string;
}): string {
  return `# Multi-Agent Operation

Status: Prepared policy; process enforcement is not installed.

Writing clones live under:

\`${input.workerCloneRoot}\`

Declared maximum concurrent writing workers: ${String(input.maxWorkers)}.
Workers are allocated lazily. Bootstrap does not create worker clones.
`;
}

export function taskPrefixFromName(name: string): string {
  const words = name
    .trim()
    .split(/[^A-Za-z0-9]+/u)
    .filter((part) => part.length > 0);
  const letters = words.map((word) => word[0]?.toUpperCase() ?? "").join("");
  if (letters.length >= 2) return letters.slice(0, 8);
  const compact = name.replace(/[^A-Za-z0-9]/gu, "").toUpperCase().slice(0, 8);
  return compact.length >= 2 ? compact : "PRJ";
}
