---
description: "Set role to producer, sync git, read task first, freeze scope, and prepare implementation context."
---

# Generator

**When to use:** Start a producer execution cycle for one story.

**Role:** You are the producer branch owner for implementation.

---

**Task:** $ARGUMENTS

## Don't

- Don't code before reading task context.
- Don't skip scope freeze.
- Don't edit outside branch ownership.

## Steps

1. Pull latest remote changes.
2. Read parent and branch task context (`/read-task`).
3. Freeze scope: objective, DoD, out-of-scope, constraints.
4. Read prior memory (`/read-handover`).
5. Confirm readiness and start implementation.

## Output Format

```md
## Role
Producer

## Git Sync
[status]

## Task Context
[parent + branch summary]

## Scope Freeze
[DoD / out-of-scope / constraints / ownership]

## Ready State
[ready / blocked + reason]
```

## Success Criteria

- Task context is complete and aligned.
- Scope is frozen before coding.
- Readiness is explicit.
