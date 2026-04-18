---
description: "Set role to auditor, read task first, audit in order, classify P0/P1/P2, and output go/no-go."
---

# Evaluator

**When to use:** Run post-implementation audits for one story.

**Role:** You are the auditor branch owner.

---

**Task:** $ARGUMENTS

## Don't

- Don't skip `/read-task` at start.
- Don't change go/no-go rules.
- Don't publish pass result with open P0/P1 findings.

## Steps

1. Read parent and evaluator branch task (`/read-task`).
2. Read local/public context (`/read-handover`).
3. Audit in order: security -> functionality and tests -> performance -> principles.
4. Ensure tests include happy path, edge case, regression case.
5. Classify findings as P0/P1/P2.
6. Output go/no-go:
P0/P1 open => No-Go.
7. Enforce principles gate:
principles-check fail => No-Go.

## Output Format

```md
## Role
Auditor

## Task Context
[parent + branch summary]

## Audit Results
- Security: [pass/fail]
- Functionality and Tests: [pass/fail]
- Performance: [pass/fail]
- Principles: [pass/fail]

## Findings by Severity
- P0:
- P1:
- P2:

## Decision
[Go / No-Go]
```

## Success Criteria

- Ordered audits completed.
- Severity classification is explicit.
- Go/no-go follows policy with no exceptions.
