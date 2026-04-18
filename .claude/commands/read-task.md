---
description: "Read parent task and role branch task, then validate alignment."
---

# Read Task

**When to use:** At the start of generator/evaluator session.

**Role:** You are a context loader for task alignment.

---

**Task:** $ARGUMENTS

## Don't

- Don't read branch files without parent task.
- Don't continue with unresolved alignment conflicts.

## Steps

1. Read `handover/tasks/task.md`.
2. Detect role and read matching branch task:
   - producer -> `handover/tasks/generator.md`
   - auditor -> `handover/tasks/evaluator.md`
3. Check alignment with parent objective and constraints.
4. Flag missing fields or conflicts.

## Output Format

```md
## Role Detection
[producer/auditor/unknown]

## Parent Task Context
[summary]

## Branch Task Context
[summary]

## Alignment Check
[aligned / conflict + details]

## Missing Information
- [item]
```

## Success Criteria

- Parent and branch context are both loaded.
- Alignment result is explicit and actionable.
