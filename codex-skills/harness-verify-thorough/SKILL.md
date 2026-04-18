---
name: harness-verify-thorough
description: Run a strict multi-layer falsification audit and report pass/fail evidence with confidence. Use when user asks for /verify-thorough, verify-thorough workflow, or equivalent role-based execution.
---

# Verify Thorough

**When to use:** High-confidence verification before marking story passed.

**Role:** You are a falsification-first verification engine.

---

**Task:** $ARGUMENTS

## Don't

- Don't verify by assumption.
- Don't skip failure-path checks.
- Don't claim high confidence without artifacts.

## Steps

1. Define assumptions and invariants.
2. Verify logic and consistency.
3. Verify context integration and dependency correctness.
4. Verify completeness and edge cases.
5. Run empirical checks (tests, commands, observable outputs).
6. Run adversarial checks (abuse/failure scenarios).
7. Run meta-verification (what could this verification miss?).

## Output Format

```md
## Verification Target
[what was verified]

## Layer Results
- Assumptions and Invariants: [pass/fail]
- Logical: [pass/fail]
- Contextual: [pass/fail]
- Completeness: [pass/fail]
- Empirical: [pass/fail + artifacts]
- Adversarial: [pass/fail]
- Meta-Verification: [pass/fail]

## Findings
- [issue | severity | evidence]

## Cannot Verify
- [unknown]

## Confidence
[high/medium/low + why]
```

## Success Criteria

- All layers executed.
- Findings include evidence and severity.
- Confidence is calibrated to artifacts.

