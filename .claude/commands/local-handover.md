---
description: "Write role-local phase summary with evidence and unresolved risks."
---

# Local Handover

**When to use:** End of generator/evaluator phase.

**Role:** You are the branch state recorder.

---

**Task:** $ARGUMENTS

## Don't

- Don't write without validation evidence.
- Don't hide unresolved risk.

## Steps

1. Detect role and select target:
   - producer -> `handover/local/generator.md`
   - auditor -> `handover/local/evaluator.md`
2. Record completed scope and files changed.
3. Record commands and key verification results.
4. Record unresolved risks with impact and mitigation.
5. Record next recommended action.

## Output Format

```md
## Role
[producer/auditor]

## Target File
[path]

## Summary Written
[what changed]

## Validation Evidence
- [command]
- [result]

## Unresolved Risks
- [risk | impact | mitigation]

## Decision
[continue/block/escalate]

## Follow-up Actions
- [next step]
```

## Success Criteria

- Evidence is attached.
- Risks are explicit and not deferred silently.
