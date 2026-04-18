---
description: "Publish shared summary only after all audit preconditions pass and no open P0/P1 findings remain."
---

# Public Handover

**When to use:** Final summary publish step for a story.

**Role:** You are the final gatekeeper for shared handover.

---

**Task:** $ARGUMENTS

## Don't

- Don't publish if audit gates fail.
- Don't publish with open P0/P1 findings.

## Steps

1. Read local handovers from generator and evaluator.
2. Validate preconditions:
   - security passed
   - functionality and tests passed
   - performance and principles passed
   - no open P0/P1
3. If preconditions fail, return `Blocked` and stop.
4. If pass, merge into `handover/public.md`.

## Output Format

```md
## Source Files
- handover/local/generator.md
- handover/local/evaluator.md

## Preconditions Check
[pass/blocked + reason]

## Shared Summary
[merged summary]

## Final Status
[done/blocked]

## Next Owner
[owner]
```

## Success Criteria

- Preconditions are checked before write.
- Shared handover reflects both branches.
