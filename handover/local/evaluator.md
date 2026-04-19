## Role
auditor

## Target File
handover/local/evaluator.md

## Summary Written
- Completed scoped evaluator audit for generator5 delivery (`T-005` settings/info path + role route gating).
- Found and remediated two issues during audit:
  - Frontend home-page logic tests failed after `inject()` usage change; tests were updated to run in Angular injection context.
  - Local dev runtime script reintroduced hardcoded Supabase values; restored env/runtime-config driven behavior (no hardcoded project values in `package.json`).
- Normalized generator5 local handover document encoding/content for continuity.

## Validation Evidence
- `npm.cmd test` (backend): passed (`32 passed, 0 failed`).
- `npm.cmd run test:runtime-config` (frontend): passed (`5 passed, 0 failed`).
- `npm.cmd run test:ci` (frontend): passed (`runtime-config tests + 27 Angular tests`).
- `npm.cmd run build` (frontend): passed.
- Verified generator5 route-gate intent:
  - `/admin` uses `roleGuard('Admin', 'Publisher')`.

## Unresolved Risks
- Backend still relies on valid `SUPABASE_SERVICE_ROLE_KEY`; missing/invalid secret breaks admin media/settings/user-role operations.
- Session storage remains in-memory (`Map`), so sessions are not shared across instances and reset on restart.
- Supabase role updates rely on token refresh/re-login to be reflected in client snapshot.

## Decision
continue

## 2026-04-19 Addendum - Generator3 Audit Remediation + Styling Principle Update (Scoped)

## Summary Written
- Completed generator3 follow-up remediation for `T-003` and cross-page styling principle hardening.
- Fixed media listing regression where admin media list inherited public cap (`120`) after helper extraction:
  - kept public `/api/showcase/media` bounded behavior,
  - restored admin `/api/admin/media` to honor configured admin upper limit.
- Added backend regression test to prevent admin-list cap regression.
- Implemented global style-token baseline and migrated key pages (home/showcase/login/register/admin) away from page-level hardcoded color literals.
- Updated principles contract: added explicit no-hardcoded-style rule in `standards/principles.md` (`R8 Style Reuse Rule`).

## Validation Evidence
- `npm.cmd test` (backend): passed (`35 passed, 0 failed`).
- `npm.cmd run test:ci` (frontend): passed (`runtime-config tests + 28 Angular tests`).
- `npm.cmd run build` (frontend): passed.

## Decision
continue

## 2026-04-19 Addendum - Generator4 Role Source-of-Truth Fix (Scoped)

## Summary Written
- Completed follow-up audit/remediation for generator4 `T-004` role management chain.
- Closed blocker where role write path and role auth path used different stores:
  - auth check path already used `profiles.role`,
  - role mutation path still wrote `app_metadata.role`.
- Backend was updated to unify role source-of-truth to `profiles.role` for:
  - bootstrap claim (`POST /api/admin/bootstrap/claim`),
  - admin role assignment (`PATCH /api/admin/users/:id/role`),
  - admin user list role rendering (`GET /api/admin/users` merged with `profiles` roles).
- Added regression tests to prevent future divergence between role update and effective permissions.

## Validation Evidence
- `npm.cmd test` (backend): passed (`33 passed, 0 failed`).
- `npm.cmd run test:ci` (frontend): passed (`runtime-config tests + 28 Angular tests`).
- `npm.cmd run build` (frontend): passed.

## Decision
continue

## Follow-up Actions
- Publish generator5 scoped public handover and history entry.
- Run post-deploy smoke on role matrix: Viewer, Publisher, Admin.

## 2026-04-18 Addendum - Runtime Supabase Fallback Safety Fix (Scoped)

## Summary Written
- Addressed evaluator risk/remediation conflict: avoid repository hardcoded runtime auth config while preventing local runtime `Missing Supabase config` breakage.
- Implemented build-time strategy in runtime-config writer:
  - development: auto-fallback to known local Supabase project values,
  - production: fail fast when `NANAMI_SUPABASE_URL` / `NANAMI_SUPABASE_ANON_KEY` are missing.
- Removed hardcoded Supabase args from npm `config:runtime` script and kept runtime source-of-truth in generated runtime config.

## Validation Evidence
- `npm.cmd run test:runtime-config` (frontend): passed (`7 passed, 0 failed`).
- `npm.cmd run test:ci` (frontend): passed (`runtime-config + 28 Angular tests`).

## Decision
continue
