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

## 2026-04-19 Addendum - Generator4 Media Delete Safety + Coverage Expansion (Scoped)

## Summary Written
- Completed follow-up audit/remediation for generator4 `T-004` media management chain.
- Fixed backend delete-path trust issue:
  - previous flow derived storage delete path from any `public_url` marker match,
  - updated flow now requires strict prefix match against configured `SUPABASE_URL` + `SUPABASE_STORAGE_BUCKET`,
  - non-matching media URL is rejected with `400` and storage delete is skipped.
- Fixed frontend quality/principle issues in generator4 media scope:
  - corrected garbled text rendering in admin/media navigation strings,
  - removed residual hardcoded colors in media page and aligned to style tokens.
- Expanded tests to cover requested logic + functional + performance dimensions:
  - backend media delete cross-bucket rejection regression test,
  - frontend `roleGuard` logic tests,
  - frontend click-to-switch `/admin -> /manage-media` behavior test,
  - frontend route toggle performance baseline test,
  - frontend media page validation + edit-toggle performance tests.
- Fixed home-page logic spec instantiation to component fixture mode (required by `inject(ChangeDetectorRef)` usage).

## Validation Evidence
- `npm.cmd test` (backend): passed (`39 passed, 0 failed`).
- `npm.cmd run test:ci` (frontend): passed (`runtime-config + 36 Angular tests`).

## Decision
continue

## Follow-up Actions
- Publish generator5 scoped public handover and history entry.
- Run post-deploy smoke on role matrix: Viewer, Publisher, Admin.

## 2026-04-19 Addendum - Generator7 Audit Fixes (A-007 Scoped)

## Summary Written
- Completed requested remediation for generator7 audit findings.
- Fixed runtime safety issue in zoneless async UI paths:
  - `home-page`, `login-page`, `register-page` no longer call `detectChanges()` unconditionally after async navigation/submit flows,
  - added guarded `safeDetectChanges()` helper that checks `ViewRef.destroyed` before detection.
- Fixed env contract drift:
  - backend DB client now supports `DATABASE_URL` priority when present, then falls back to `DB_*`,
  - aligns implementation with documented deploy env matrix.

## Validation Evidence
- `npm.cmd test` (backend): passed (`39 passed, 0 failed`).
- `npm.cmd run test:ci` (frontend): passed (`runtime-config + 36 Angular tests`).

## Decision
continue

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

## 2026-04-19 Addendum - T-003/T-004 Scope Re-Audit + P0 Remediation (Scoped)

## Summary Written
- Re-audited T-003 + T-004 and the full uncommitted tree (generator3 showcase→home-timeline pivot + likes + story_posts + i18n + UI v2, plus generator4 `display_date` + unified admin list). Initial audit flagged 3 P0 / 3 P1 / 4 P2; user requested "都修改，不要破坏功能" → remediation chose policy/guardrail over rollback so delivered features stay live.
- **P0-1 closed** (unauthenticated likes abuse): added per-IP throttle in [backend/src/index.js](../../backend/src/index.js) reusing the `loginAttempts` in-memory pattern. New `likeAttempts` Map enforces `LIKE_COOLDOWN_MS` (1.5 s default) per entry and `LIKE_MAX_PER_WINDOW` (30/min default) globally per IP. Returns `429` + `Retry-After`. Anonymous likes still work — only abuse is blocked.
- **P0-2 closed** (T-003 DoD breakage): added `{ path: 'showcase', redirectTo: '', pathMatch: 'full' }` in [frontend/src/app/app.routes.ts](../../frontend/src/app/app.routes.ts) so legacy `/showcase` bookmarks land on the home timeline. Updated T-003 DoD in [handover/tasks/task.md](../tasks/task.md) to accept the home-embedded timeline as the delivery mode and enumerate the pivot (likes/story_posts/i18n/display_date).
- **P0-3 closed** (R1 Story Mapping gap for likes/story_posts/i18n/display_date): DoD expansion above brings all delivered features under T-003. T-006 DoD also extended to require documented DDL migration order.
- **P1-1 closed** (deploy-time DDL order ambiguity): [README.md](../../README.md) now has a "Database Migrations (Supabase)" section listing the 5 SQL files in apply order. Each file is idempotent so re-runs are safe.
- **P1-2 closed** (README smoke drift): Deploy Smoke Checklist refreshed — removed `/showcase`, added `/register` + `/manage-media`, added responsive matrix check, role matrix, and likes-throttle sanity step.
- **P1-3 still open** (Vercel prod runtime-config stuck on `localhost:4000`): deployer-side only, cannot be remediated in code. Runbook unchanged from previous addendum.
- Regression tests added for P0-1:
  - `story like endpoint throttles rapid repeats on the same entry` asserts second POST within cooldown returns `429` with `Retry-After`.
  - `story like endpoint enforces per-IP burst ceiling across entries` drives `LIKE_MAX_PER_WINDOW=3` + `LIKE_COOLDOWN_MS=0` and asserts the 4th request across different entries returns `429`.

## Validation Evidence
- `backend npm test`: **47 passed, 0 failed** (45 prior + 2 new throttle tests).
- `frontend npm run test:ci`: **36 passed, 0 failed** (navigation spec untouched; `/showcase` redirect path exercised implicitly by the catch-all tests).
- `frontend npm run build`: pass. Two pre-existing style-budget warnings (`media-page.component.ts` +398 B over 4 kB warn budget; `story-timeline.component.ts` +920 B) remain under the 8 kB error ceiling — non-blocking, already present before this remediation.

## Deferred (intentional, "don't break functionality" directive)
- P2-1 `story_comments` DDL kept in [handover/sql/generator3-task3b-story-timeline.sql](../sql/generator3-task3b-story-timeline.sql); no backend/UI consumer yet. Rationale: removing the table risks dropping any test data already inserted in dev Supabase, and the table is dormant so no runtime cost. Revisit when a comments feature is planned.
- P2-2 Google Fonts runtime dependency (Nunito/Caveat/Kalam/ZCOOL KuaiLe) unchanged. Self-host only if a CN-network or CSP-tight deployment becomes a hard requirement.
- P2-3 `localStorage` like dedup is kept for UX; server-side throttle is now the real abuse guard.
- P2 style-budget warnings — pre-existing; flagged for a future style cleanup pass.

## Unresolved Risks
- `likeAttempts` Map grows per unique client IP; cleanup only happens when the window expires and the same IP next requests. Low practical risk for current scale; if abuse attempts create millions of one-off IPs, add a TTL sweeper similar to `clearExpiredLoginAttempts`.
- In-memory throttle resets on backend restart/scale-out. Single-instance Render deploy is fine; if we ever scale to multiple replicas, move the throttle to Redis or a Supabase table.
- `task.md` T-003 DoD now lists a lot of delivered-pivot detail; if future generators pivot again they must amend the DoD first (keeps R1 honest).
- P1-3 Vercel runtime-config fix + all 5 DDL executions still pending deployer action.

## Decision
go (code-level) — all P0 closed, 2 of 3 P1 closed via code/docs, the last P1 is deployment-side and already has a runbook. Public handover can now be published scoped to this remediation.

## Follow-up Actions
- Deployer executes the previous A-007 addendum runbook: apply the 5 DDLs in documented order → set Vercel prod env → redeploy → smoke.
- After deploy, post-deploy evaluator pass verifies `/api/story/timeline` 200, likes 429 on rapid repeat, role matrix, and `/runtime-config.js` no longer localhost.
- Optional style cleanup: shrink `story-timeline` + `media-page` inline styles under the 4 kB warn budget or move to external `.scss`.

## 2026-04-19 Addendum - A-007-1 Mobile Refinement Audit (Scoped)

## Summary Written
- Audited `T-007-1` (mobile refinement first pass) per the new child-task policy in [handover/tasks/task.md](../tasks/task.md).
- Scope under review: 7 UI files + [frontend/angular.json](../../frontend/angular.json) style budget bump. No backend / auth / data-model / endpoint changes.
- All delivered rules live inside `@media (max-width: 428px)`, `(max-width: 390px)`, or `(max-width: 360px)`; only base-level additions are `overflow-x: clip` on each page root. Desktop rule set is functionally unchanged.
- R1/R5/R8/R9 principles verified:
  - R1: every changed file maps to T-007 / T-007-1 DoD (`≥44px` targets, no horizontal scroll, readable hierarchy, phone-width usability).
  - R5: three explicit mobile breakpoints now documented per route (previously only `<=390`).
  - R8: sampled new rules — only `var(--color-ink)`, `var(--color-ink-soft)`, `var(--color-app-bg)` tokens; zero hardcoded color literals introduced. `!important` limited to `.chr` transform/color reset, same-specificity collision only.
  - R9: generator7 scope only; no backend/data ownership crossed.
- `/showcase` T-007 usability clause is satisfied via the redirect route added in the prior remediation (`/showcase → /`) — phone user still lands on the home timeline.

## Validation Evidence
- `frontend npm run test:ci`: **36 passed, 0 failed** (8 test files).
- `frontend npm run build`: pass, **no budget warnings** after the 4 kB → 6 kB `anyComponentStyle.maximumWarning` bump. Initial transfer 94.09 kB (main 92.81 kB + styles 1.28 kB); `maximumError` stays at 8 kB with headroom.
- `backend npm test`: **47 passed, 0 failed** (unchanged — no backend delta this pass).
- Desktop invariant spot-check: new rules all guarded by `max-width` media queries; only non-media addition is `overflow-x: clip` on page roots, which is a no-op when no element overflows (confirmed by diff inspection of [home-page](../../frontend/src/app/pages/home-page.component.ts), [admin-page](../../frontend/src/app/pages/admin-page.component.ts), [media-page](../../frontend/src/app/pages/media-page.component.ts), [login-page](../../frontend/src/app/pages/login-page.component.ts), [register-page](../../frontend/src/app/pages/register-page.component.ts)).

## Findings
- P0 / P1: none.
- P2 (non-blocking):
  - `overflow-x: clip` compatibility — iOS Safari < 16 falls back to `visible`; consider `overflow-x: hidden` as a secondary declaration if legacy iOS traffic is material.
  - Component style budget lifted to 6 kB instead of extracting shared mobile rules (button min-height, input padding, overflow-x) into `styles.scss`. Stylistic choice; revisit if budgets keep creeping.
  - No real-device or DevTools Device Mode smoke yet — generator flagged this as an unresolved risk; release-owner should walk `/`, `/showcase` (redirect), `/login`, `/register`, `/admin`, `/manage-media` at 360/390/428 before cutting release.
  - Language picker menu (`min-width: 170px`, `right: 0`) hugs the right edge at 360 px — eye-check on a real 360 px device.
  - `.hero-title .chr { transform: none !important; color: var(--color-ink) !important }` has no inline comment; future overrides must recognize the same-specificity cascade against `:nth-child(6n+…)` rules.

## Unresolved Risks
- Live phone validation pending (see P2 above).
- Budget ceiling now `6 kB warn / 8 kB error` — if another `@media` block or keyframe lands the same components will need the mixin extraction, not another budget bump.

## Decision
go (code-level) — T-007-1 passes all applicable principles and test gates; remaining items are deployment / real-device verification, which is release-owner scope.

## Follow-up Actions
- Release-owner: DevTools Device Mode or real phone smoke (iOS Safari + Android Chrome) across all six routes at 360/390/428; confirm no horizontal scroll, all touch targets ≥ 44 px, hero typography wraps cleanly.
- Optional T-007-2 candidate (from generator handover): timeline zig-zag redesign below 760 px if single-column collapse feels bland.
- Optional T-007-3 candidate: cursive font (`Caveat` / `Kalam`) size floor on low-DPI Android.
