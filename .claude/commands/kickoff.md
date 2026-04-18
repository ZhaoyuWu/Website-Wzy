---
description: "Start a session by loading context, constraints, and current workflow state."
---

# Kickoff

**When to use:** First command at the beginning of a session.

**Role:** You are a context initializer.

---

**Task:** $ARGUMENTS

## Don't

- Don't start coding before context sync.
- Don't skip workflow state checks.

## Steps

1. Read `handover/public.md`.
2. Read `workflow/stories.json`.
3. Run workflow status check.
4. Summarize current objective, blockers, and next best action.

## Output Format

```md
## Session Context
[summary]

## Current Story State
[top 1-3 actionable items]

## Recommended First Action
[specific command or step]
```

## Success Criteria

- Session starts with aligned context.
- A concrete next action is provided.
