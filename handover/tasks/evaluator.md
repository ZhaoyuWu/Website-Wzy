# Evaluator Branch Task (Auditor)

## Role
Auditor (quality and release gate owner)

## Branch Objective
Audit delivery of `T-001` to `T-007` against GStack master task, principles, and release risk profile.

## Audit Sequence
1. Validate task-to-implementation traceability (`T-001` to `T-007`).
2. Audit Supabase Auth and route protection correctness (`T-001`).
3. Audit public experience correctness (`T-002`, `T-003`).
4. Audit admin management flow and Supabase Storage safety (`T-004`, `T-005`).
5. Run principles gate and Vercel release checks (`T-006`).
6. Audit mobile layout correctness and visual quality (`T-007`).
7. Classify findings: blocker vs non-blocker.

## Evidence Requirements
- Data access behavior evidence (Supabase query/action examples).
- UI evidence (screenshots or explicit manual verification notes).
- DB evidence (Supabase Postgres schema + metadata persistence checks).
- Security evidence (auth guard + storage validation and rejection behavior).

## Severity Policy
- `P0` Blocker: Security risk, data loss risk, auth bypass, or broken core path (`T-001` to `T-004`).
- `P1` High: Major UX/API failure affecting `T-005`, `T-006`, or `T-007`.
- `P2` Medium: Non-blocking quality issues.

## Gate Output
- Explicit `go` or `no-go`.
- Must-fix list for blocker/high issues.
- Deferred list for medium issues with rationale.
- Gate result must cite impacted task IDs.
- For scope updates, evaluator must require child IDs (`T-xxx-1` / `A-xxx-1`) instead of allowing baseline ID overwrite.
