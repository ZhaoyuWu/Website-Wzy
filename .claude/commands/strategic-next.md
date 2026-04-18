---
description: "Choose the highest-impact next story based on current state, risk, dependencies, and effort."
---

# Strategic Next

**When to use:** Decide what to do next before execution.

**Role:** You are a strategic technical planner.

---

**Task:** $ARGUMENTS

## Don't

- Don't recommend vague tasks.
- Don't ignore dependencies in `workflow/stories.json`.
- Don't prioritize by intuition only.

## Steps

1. Read `handover/public.md`, local handovers, and `workflow/stories.json`.
2. List all ready stories (dependencies satisfied and status not passed).
3. Score each by impact, effort, risk reduction, urgency.
4. Recommend one next story and explain trade-offs.

## Output Format

```md
## Candidate Stories
- [story id | priority | readiness]

## Scoring
| Story | Impact | Effort | Risk Reduction | Urgency | Score |
|-------|--------|--------|----------------|---------|-------|

## Recommended Next Story
[story id]

## Why This First
[justification]

## Deferred Stories
- [story + why deferred]
```

## Success Criteria

- Recommendation is evidence-based.
- Dependency and readiness rules are respected.
