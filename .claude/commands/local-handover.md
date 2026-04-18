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
- Don't overwrite another generator/evaluator's file.

## Steps

1. Detect role number and task number from context (e.g. "generator4 doing task4" → `generator4-task4`).
2. Select target file:
   - producer → `handover/local/generator{N}-task{N}.md`
   - auditor  → `handover/local/evaluator{N}-task{N}.md`
3. Record completed scope and files changed.
4. Record commands and key verification results.
5. Record unresolved risks with impact and mitigation.
6. Record next recommended action.

## Output Format

```md
## Role
generator{N} / evaluator{N}

## Task
task{N} — [T-00X short title]

## Target File
handover/local/generator{N}-task{N}.md

## Summary Written
[what changed]

## Validation Evidence
- [command]: [result]

## Unresolved Risks
- [risk] | [impact] | [mitigation]

## Decision
[continue/block/escalate]

## Follow-up Actions
- [next step]
```

## Success Criteria

- File is named `generator{N}-task{N}.md` or `evaluator{N}-task{N}.md` — never overwrites a shared file.
- Evidence is attached.
- Risks are explicit and not deferred silently.
