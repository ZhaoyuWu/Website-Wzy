## 2026-07-24/28 Maintenance Overhaul - Audit, Recovery, Hardening, Modernization, Portfolio (A-006-1 + G7 children)

## Source Files
- backend/src/index.js (Supabase-only auth, comment throttle, entry_likes, signed-upload endpoints)
- backend/test/{auth,media,settings}.test.js (rewritten to Supabase-mocked fixtures)
- frontend/src/app/core/{auth.service.ts,runtime-config.ts} (token refresh, apiFetch, override removal)
- frontend/src/app/pages/* and components/* (template extraction, signals, dead-code removal)
- frontend/vercel.json, frontend/src/app/app.routes.ts
- .github/workflows/{keep-alive.yml,tests.yml}, LICENSE, README.md, docs/DEVELOPMENT.md
- handover/sql/entry-likes-persistence.sql (migration row 8)

## Preconditions Check
pass (audit-driven): work began from full-stack audit `A-006-1`; every change maps to a G7 child task in `handover/tasks/task.md`; each round shipped only after backend + frontend suites and a production build passed, then was deployed and probed on production.

## Shared Summary
- Round 1 (backend truth): removed the dead local-Postgres auth stack (server never built a pg pool; frontend authenticates against Supabase GoTrue directly). Added per-IP comment throttling. Rewrote test fixtures. `T-006-1`, `T-003-1`.
- Round 1 incident: Supabase free project had auto-paused (~3 months idle, domain NXDOMAIN) - data layer was down unnoticed. Restored by user; `keep-alive.yml` (10-min ping from `main`) now prevents recurrence and provides free failure-email alerting. `T-006-2`.
- Round 2 (security/ops): fixed hard 404s on direct SPA routes (dropped `cleanUrls` + lookahead rewrite for a plain catch-all), security headers everywhere, removed the `localStorage` runtime-config override backdoor, silent session refresh, durable `entry_likes` with in-memory fallback, redacted the plaintext admin password from `deployer.md`. `T-006-2`, `T-001-1`, `T-003-1`.
- Round 3 (pipeline): direct-to-storage uploads via signed URLs with server-side existence/true-size verification (real 50MB videos); lazy admin routes (452 -> 390 kB initial); central `apiFetch` migration for all admin/media call sites. `T-004-1`, `T-006-3`.
- Round 4 (modernization): `admin-page`/`media-page`/`story-timeline` extracted templates/styles and migrated async state to signals/`computed` - zero manual change-detection calls remain; `home-page` template extracted with signal migration intentionally skipped (animation-timing risk on the landing page). `T-006-3`.
- Round 5 (portfolio): deleted the unused `StoryTimelineComponent` (2200 lines) and broken `#story` anchor found while screenshotting production; showcase README with Playwright-captured screenshots + mermaid architecture; `tests.yml` CI (first run green); MIT LICENSE; `docs/DEVELOPMENT.md`; first `admin-page` test suite. `T-006-1`, `T-006-4`.
- Validation: backend `58/58`, frontend `64/64`, production build green, CI green on `main`; production probed after every deploy (routes 200, timeline serving data, removed endpoints 404).

## Final Status
done (scoped) - open user actions: apply migration row 8 in Supabase SQL editor; rotate the admin password (old value remains in public git history); rename repo to `nanami-website`; create Publisher demo account for the README.

## 2026-04-23 Scoped Update - Generator7 Style Budget Slimming (No Visual Regression)

## Source Files
- frontend/src/app/pages/home-page.component.ts
- frontend/src/app/components/story-timeline.component.ts
- frontend/src/styles.scss
- frontend/angular.json
- handover/local/evaluator.md

## Preconditions Check
pass (scoped): latest generator7 visual bundle was functionally correct but component-style budget pressure remained; remediation had to reduce budget risk without degrading current UI behavior.

## Shared Summary
- Completed evaluator-side slimming for latest generator7 changes with no behavior rollback:
  - moved large responsive/motion rule blocks from component-inline styles to global stylesheet with host scoping (`app-home-page`, `app-story-timeline`),
  - preserved original selectors, class names, animations, and interaction semantics to keep rendered behavior unchanged,
  - retained tokenized visual values and principle compliance (no new hardcoded color/style literals in feature pages).
- Tightened style governance target in Angular build config:
  - `anyComponentStyle.maximumWarning = 10kB`
  - `anyComponentStyle.maximumError = 12kB`
- Result:
  - previous warnings on `home-page.component` / `story-timeline.component` are cleared,
  - build remains green under stricter thresholds,
  - visual effects (hero entrance/parallax/chalk atmosphere/timeline reveal/tactile feedback) remain active.
- Validation passed:
  - `frontend npm run build`: pass (no component-style budget warnings)
  - `frontend npm run test:ci`: pass (`41/41`)

## Final Status
done (scoped)

## Next Owner
release-owner

---

## Source Files
- handover/local/generator5-task5.md
- handover/local/generator.md
- handover/local/evaluator.md

## Preconditions Check
pass (scoped): no unresolved blocker for generator5 settings/role-route audit.

## Shared Summary
- Task focus: generator5 `T-005` settings/info flow and role-route gate behavior.
- Evaluator verified generator5 intent and remediated audit findings:
  - fixed frontend tests broken by `inject()` context change in home-page logic specs,
  - removed reintroduced hardcoded Supabase values from local runtime script,
  - confirmed `/admin` route remains role-gated for `Admin` and `Publisher`.
- Generator5 local handover encoding/content was normalized to prevent continuity break.
- Verified evidence:
  - `backend npm test`: `32/32` pass
  - `frontend npm run test:runtime-config`: `5/5` pass
  - `frontend npm run test:ci`: pass (`runtime-config + 27 Angular tests`)
  - `frontend npm run build`: pass
- Scope note: this handover is scoped to generator5/T-005 audit and does not replace environment-specific production smoke verification.

## Final Status
done (scoped)

## Next Owner
release-owner

---

## 2026-04-19 Scoped Update - Generator7 Audit Remediation (A-007)

## Source Files
- frontend/src/app/pages/home-page.component.ts
- frontend/src/app/pages/register-page.component.ts
- frontend/src/app/pages/login-page.component.ts
- backend/src/db.js
- handover/local/evaluator.md

## Preconditions Check
pass (scoped): evaluator audit found release-blocking runtime safety issues and one env-contract mismatch that required immediate remediation.

## Shared Summary
- Fixed zoneless/runtime safety blocker for auth/home flows:
  - previous pattern called `ChangeDetectorRef.detectChanges()` unconditionally in async `finally` blocks after navigation,
  - this can hit a destroyed view and throw runtime errors,
  - all affected pages now use a guarded `safeDetectChanges()` that checks `ViewRef.destroyed` before running detection.
- Fixed deployment/env contract mismatch:
  - README env matrix already documented `DATABASE_URL`,
  - backend DB bootstrap now supports `DATABASE_URL` as first-priority connection source, with `DB_*` fallback preserved.
- Scope note:
  - no new endpoint/schema/role behavior was introduced,
  - only safety hardening and runtime-config compatibility were changed.
- Validation passed:
  - `backend npm test`: `39/39` pass
  - `frontend npm run test:ci`: pass (`runtime-config + 36 Angular tests`)

## Final Status
done (scoped)

## Next Owner
release-owner

---

## 2026-04-19 Scoped Update - Generator4 Media Safety + Test Expansion

## Source Files
- backend/src/index.js
- backend/test/media.test.js
- frontend/src/app/pages/media-page.component.ts
- frontend/src/app/pages/media-page.component.spec.ts
- frontend/src/app/core/auth.guard.spec.ts
- frontend/src/app/app.navigation.spec.ts
- frontend/src/app/pages/home-page.component.spec.ts
- frontend/src/app/pages/admin-page.component.ts
- handover/local/evaluator.md

## Preconditions Check
pass (scoped): generator4 audit identified a delete-path trust risk and coverage gaps requiring immediate remediation before release handoff.

## Shared Summary
- Closed media delete-path trust gap:
  - backend now only allows storage deletion when `public_url` matches configured `SUPABASE_URL + SUPABASE_STORAGE_BUCKET` prefix,
  - non-matching bucket/path now returns `400` and aborts storage delete call.
- Preserved generator4 media metadata behavior:
  - admin media list includes `updated_at`,
  - metadata patch stamps `updated_at`.
- Fixed generator4 UI quality issues:
  - corrected mojibake/garbled text in media/admin pages,
  - removed remaining hardcoded danger/muted colors from media page and switched to reusable style tokens.
- Expanded tests across logic + functional + performance:
  - backend delete endpoint now has cross-bucket rejection coverage,
  - role-guard logic tests now include allow/unauth/unauthorized branches,
  - navigation tests include click switch to `/manage-media` and toggle latency baseline,
  - media page tests cover file-type validation, date fallback logic, and edit-toggle performance loop.
- Validation passed:
  - `backend npm test`: `39/39` pass
  - `frontend npm run test:ci`: pass (`runtime-config + 36 Angular tests`)

## Final Status
done (scoped)

## Next Owner
release-owner

---

## 2026-04-19 Scoped Update - Generator3 Fix + No-Hardcoded-Style Principle

## Source Files
- backend/src/index.js
- backend/test/media.test.js
- frontend/src/styles.scss
- frontend/src/app/pages/home-page.component.ts
- frontend/src/app/pages/showcase-page.component.ts
- frontend/src/app/pages/login-page.component.ts
- frontend/src/app/pages/register-page.component.ts
- frontend/src/app/pages/admin-page.component.ts
- standards/principles.md
- handover/local/evaluator.md

## Preconditions Check
pass (scoped): generator3 audit found a medium functional regression and style-governance gap requiring policy-level guardrail.

## Shared Summary
- Fixed generator3 follow-up functional regression:
  - admin media endpoint now preserves configured admin list ceiling instead of being clipped by public showcase cap.
- Added backend regression coverage to keep admin/public list cap behavior separated.
- Added global reusable style-token layer and migrated major pages to token references, removing page-level hardcoded color literals.
- Principles contract updated with explicit styling governance rule:
  - `R8 Style Reuse Rule` in `standards/principles.md` now forbids hardcoded visual values in feature pages unless explicitly approved and documented.
- Validation passed:
  - `backend npm test`: `35/35` pass
  - `frontend npm run test:ci`: pass (`runtime-config + 28 Angular tests`)
  - `frontend npm run build`: pass

## Final Status
done (scoped)

## Next Owner
release-owner

---

## 2026-04-19 Scoped Update - Generator4 Role Consistency Remediation

## Source Files
- backend/src/index.js
- backend/test/auth.test.js
- handover/local/evaluator.md

## Preconditions Check
pass (scoped): generator4 audit identified role-consistency blocker requiring immediate backend remediation.

## Shared Summary
- Resolved a blocking role consistency issue in generator4 scope:
  - role authentication already read from `profiles.role`,
  - but bootstrap/admin role updates were still writing `app_metadata.role`.
- Unified role write/read behavior to `profiles.role` across role claim, role assignment, and admin user list role projection.
- Added regression tests that verify role updates affect effective permission outcomes rather than only response payload shape.
- Validation passed:
  - `backend npm test`: `33/33` pass
  - `frontend npm run test:ci`: pass (`runtime-config + 28 Angular tests`)
  - `frontend npm run build`: pass

## Final Status
done (scoped)

## Next Owner
release-owner

---

## 2026-04-18 Scoped Update - Runtime Supabase Config Safety

## Source Files
- frontend/scripts/write-runtime-config.mjs
- frontend/scripts/write-runtime-config.test.mjs
- frontend/src/app/core/runtime-config.spec.ts
- frontend/package.json
- frontend/public/runtime-config.js
- handover/local/evaluator.md

## Preconditions Check
pass (scoped): requested fix must preserve local functionality and avoid unsafe hardcoded config policy drift.

## Shared Summary
- Fixed the Supabase config regression path with a dual-mode policy:
  - development builds auto-populate runtime config fallback values to prevent local login/runtime breakage,
  - production builds require explicit `NANAMI_SUPABASE_URL` and `NANAMI_SUPABASE_ANON_KEY` and fail fast when missing.
- Removed hardcoded Supabase CLI args from `frontend/package.json` `config:runtime` so repository script no longer pins project credentials.
- Expanded runtime-config tests to verify both development fallback and production mandatory-config guardrails.
- Validation passed:
  - `frontend npm run test:runtime-config`: `7/7` pass
  - `frontend npm run test:ci`: pass (`runtime-config + 28 Angular tests`)

## Final Status
done (scoped)

## Next Owner
release-owner
