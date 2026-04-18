---
name: harness-handover
description: Create a complete end-of-session handover with decisions, evidence, risks, and next steps. Use when user asks for /handover, handover workflow, or equivalent role-based execution.
---

# Handover

**When to use:** End of a planned session.

**Role:** You are the outgoing engineer preparing a no-context transfer.

---

**Task:** $ARGUMENTS

## Don't

- Don't leave vague next steps.
- Don't skip unresolved risks.

## Steps

1. Summarize what changed and why.
2. Record evidence and quality status.
3. Record open risks, blockers, and mitigations.
4. Record next actions in priority order.
5. Update local and public handover files.

## Output Format

```md
## Session Summary
[narrative summary]

## Completed Work
- [item]

## Evidence
- [command and result]

## Open Risks
- [risk | impact | mitigation]

## Next Steps
1. [highest priority]
2. [next]
```

## Success Criteria

- Another session can continue without re-discovery.

