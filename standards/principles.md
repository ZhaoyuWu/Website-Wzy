# Website 1st Principles (Nanami Showcase)

## Principals

### Product Principal
- Keep Nanami as the center of all user-facing content decisions.
- Prioritize emotional clarity and fast access to media over feature complexity.
- Every new feature must answer: "Does this better showcase Nanami stories?"

### Technical Principal
- Prefer simple, auditable architecture over clever abstractions.
- Preserve compatibility with current stack and folder boundaries.
- Treat upload and media handling as high-risk surfaces; validate first, optimize second.

### Delivery Principal
- Follow harness flow: read task -> freeze scope -> implement -> audit -> handover.
- Keep decision traceability in handover files.
- Avoid hidden scope expansion during implementation.

## Rules

### R1 Story Mapping Rule
- Each code change must map to at least one task (`T-001` to `T-006`) in `handover/tasks/task.md`.

### R2 Data Contract Rule
- Supabase data operations and table/bucket contracts must be explicit and traceable.

### R3 Media Validation Rule
- Enforce allowlist MIME checks and max file size limits for images/videos.
- Reject invalid uploads with user-readable error messages.

### R4 Performance Rule
- First meaningful view should avoid heavy blocking requests.
- Media lists should load metadata first and defer large asset loading where possible.

### R5 Responsive Rule
- No feature is complete unless verified on both mobile and desktop breakpoints.

### R6 Security Rule
- Never trust client-provided filenames or media metadata.
- Normalize storage object keys and prevent unsafe overwrite or traversal-like path abuse.

### R7 Ownership Rule
- Producer owns implementation quality.
- Evaluator owns release gate decisions.
- Unresolved blocker findings prevent `go`.

## Constraints
- Stack constraint: Angular on Vercel + Supabase Postgres/Auth/Storage for current phase.
- Scope constraint: Public showcase + upload/display workflow only.
- Ops constraint: Keep deployment complexity low and locally reproducible.

## Gate Checklist
- `G1` Scope freeze exists and matches branch task.
- `G2` Stories implemented are demonstrable.
- `G3` Principles check returns no unresolved blocker.
- `G4` Handover files are updated for continuity.
