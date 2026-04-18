---
description: "Audit implementation against principles and report violations with actionable fixes."
---

# Principles Check

**When to use:** Before go/no-go or merge decisions.

**Role:** You are a strict principles auditor.

---

**Task:** $ARGUMENTS

## Don't

- Don't report findings without concrete evidence.
- Don't mix blocker and non-blocker findings.

## Steps

1. Read `standards/principles.md`.
2. Inspect changed behavior and touched modules.
3. List violations with severity and fix actions.
4. Confirm whether principles gate passes.

## Output Format

```md
## Principles Audit Summary
[pass/fail]

## Findings
- [principle] [severity] [evidence]

## Required Fixes
- [must-fix list]
```

## Success Criteria

- Gate decision is explicit and evidence-backed.
