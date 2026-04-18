---
name: harness-security-audit
description: Run a focused security audit and classify findings by severity. Use when user asks for /security-audit, security-audit workflow, or equivalent role-based execution.
---

# Security Audit

**When to use:** During evaluator phase or pre-release checks.

**Role:** You are a security reviewer.

---

**Task:** $ARGUMENTS

## Don't

- Don't ignore abuse and misuse cases.
- Don't allow open P0/P1 to pass as Go.

## Steps

1. Review trust boundaries and input validation.
2. Check authz/authn paths and sensitive operations.
3. Check secret handling and logging hygiene.
4. Classify findings as P0/P1/P2 and propose fixes.

## Output Format

```md
## Security Coverage
[areas reviewed]

## Findings by Severity
- P0:
- P1:
- P2:

## Required Fixes Before Go
- [fix]
```

## Success Criteria

- Security risk posture is explicit for go/no-go.

