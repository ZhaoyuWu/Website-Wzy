# Task Assignment Sheet (Generator / Evaluator)

## Usage
- Assign implementation by `T-xxx` to generator.
- Assign corresponding audit by `A-xxx` to evaluator.
- Keep IDs in commit notes and handover outputs.
- Never overwrite baseline tasks. Use child IDs for updates (e.g., `T-001-1`, `A-001-1`).

## Assignment Matrix

### T-001 / A-001
- Task: Login window (admin entry + route protection).
- Generator deliverables:
  - Login page UI and validation states.
  - Supabase Auth integration and session handling.
  - Route guard for admin pages.
- Evaluator checks:
  - Unauthenticated users cannot access admin routes.
  - Invalid credentials return safe error messages.
  - Session persistence/logout behavior is correct.

### T-002 / A-002
- Task: Homepage (public).
- Generator deliverables:
  - Nanami intro hero and profile section.
  - Navigation links to showcase and other pages.
  - Mobile/desktop layout baseline.
- Evaluator checks:
  - Page is public and renders without auth.
  - Key content blocks match task intent.
  - Responsive behavior is acceptable.

### T-003 / A-003
- Task: Showcase page (public media display).
- Generator deliverables:
  - Supabase-driven media list render (images/videos).
  - Stable media preview/playback behavior.
  - Empty/loading/error states.
- Evaluator checks:
  - Supabase data correctly appears in UI.
  - Video playback and image rendering are reliable.
  - Error and empty states are user-readable.

### T-004 / A-004
- Task: Upload and edit interface (admin).
- Generator deliverables:
  - Upload form for image/video + metadata (Supabase Storage).
  - Edit form for existing media metadata (Supabase Postgres).
  - Validation for file type/size and metadata.
- Evaluator checks:
  - Allowed files succeed; disallowed files are rejected.
  - Metadata updates persist and re-render correctly.
  - No unsafe object key/path handling in storage flow.

### T-005 / A-005
- Task: Information and settings page (admin).
- Generator deliverables:
  - Site information fields (about/profile/contact-like fields).
  - Preferences/settings persistence and UI feedback.
  - Supabase Postgres mapping for settings.
- Evaluator checks:
  - Save/update flow is consistent and recoverable.
  - Validation prevents malformed/unsafe inputs.
  - Settings changes are reflected in target pages.

### T-006 / A-006
- Task: Cross-cutting hardening and release readiness.
- Generator deliverables:
  - Responsive fixes for key breakpoints.
  - Performance cleanup for first screen and media loading.
  - Vercel deployment configuration and env checks.
  - Update handover evidence and change summary.
- Evaluator checks:
  - Principles gate outcome is explicit (`pass/fail`).
  - Vercel deployment can serve expected pages/routes.
  - No unresolved blocker findings.
  - Release recommendation (`go/no-go`) is justified.

### T-007 / A-007
- Task: Mobile layout correctness and elegance polish.
- Generator deliverables:
  - Phone-first layout pass for `/`, `/showcase`, `/login`, `/admin`, `/manage-media`.
  - Remove page-level horizontal overflow on `360px`, `390px`, `428px`.
  - Ensure touch-friendly controls and consistent small-screen spacing rhythm.
  - Refine typography hierarchy for readability on phone.
- Evaluator checks:
  - No clipping/overlap/horizontal scroll on key pages.
  - Main actions are easy to tap and not crowded.
  - Visual hierarchy remains clear and consistent on mobile.
  - Regression check passes on desktop after mobile polish.
