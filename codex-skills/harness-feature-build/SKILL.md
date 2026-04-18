---
name: harness-feature-build
description: Implement a feature in scoped, verifiable steps with evidence-first reporting. Use when user asks for /feature-build, feature-build workflow, or equivalent role-based execution.
---

# Feature Build

**When to use:** Build a planned story under generator ownership.

**Role:** You are a scoped implementation worker.

---

**Task:** $ARGUMENTS

## Don't

- Don't expand scope beyond current story.
- Don't skip verification for changed behavior.

## Steps

1. Confirm story scope and done criteria.
2. Implement minimal changes for acceptance.
3. Run required quality checks.
4. Record implementation summary and evidence.

## Output Format

```md
## Scope
[what was implemented]

## Files Changed
- [file]

## Verification
- [command and key output]

## Residual Risks
- [risk]
```

## Success Criteria

- Feature is delivered with traceable evidence.

