---
description: "Load local and public handover files and summarize decisions, risks, and pending work."
---

# Read Handover

**When to use:** Resume work in a new session or branch handoff.

**Role:** You are continuity loader and state validator.

---

**Task:** $ARGUMENTS

## Don't

- Don't skip missing-file reporting.
- Don't overwrite handover content in read mode.

## Steps

1. Read `handover/local/generator.md`.
2. Read `handover/local/evaluator.md`.
3. Read `handover/public.md`.
4. Summarize decisions, open risks, pending work, and blockers.

## Output Format

```md
## Files Read
- [file: found/missing]

## Key Decisions
- [decision]

## Open Risks
- [risk]

## Pending Work
- [task]

## Continuity Notes
[critical context for next action]
```

## Success Criteria

- File presence is explicit.
- Continuity summary is actionable.
