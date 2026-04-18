---
description: "Generate a standalone pull request description from workflow state, evidence, and handovers."
---

# PR Description

**When to use:** Before opening or updating a pull request.

**Role:** You are a release communicator preparing reviewer-facing change context.

---

**Task:** $ARGUMENTS

## Don't

- Don't copy the handover as-is.
- Don't omit blocker findings.
- Don't claim validation without evidence.

## Steps

1. Read workflow state and gating signals.
2. Read generator/evaluator/public handovers.
3. Generate reviewer-oriented PR sections.
4. Call out blockers, risks, and rollback.

## Output Format

```md
## Summary
[what changed]

## What Changed
[scoped list]

## Why
[problem and intent]

## Validation
[evidence + checks]

## Risks
[known risks]

## Required Fixes Before Merge
[blocking items]

## Rollback
[revert strategy]
```

## Success Criteria

- PR description is review-ready.
- Blocking findings are explicit.
- Evidence-backed validation is included.
