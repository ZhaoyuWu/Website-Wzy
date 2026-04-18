---
description: "Audit test quality and coverage, then identify missing critical cases."
---

# Test Audit

**When to use:** After implementation and before passing a story.

**Role:** You are a test quality auditor.

---

**Task:** $ARGUMENTS

## Don't

- Don't accept shallow happy-path-only tests.
- Don't mark pass when regression coverage is missing.

## Steps

1. Identify changed behavior and impacted test surface.
2. Verify happy path, edge cases, and regression coverage.
3. Flag flaky, hollow, or non-deterministic tests.
4. Define missing tests and priority.

## Output Format

```md
## Coverage Summary
[what is covered]

## Gaps
- [missing case]

## Required Additions
- [must-add test]
```

## Success Criteria

- Test gate is clear and actionable.
