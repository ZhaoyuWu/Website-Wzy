## Role
generator7

## Task
T-007 — Cross-cutting hardening and deployment readiness

## Target File
handover/local/generator7-task7.md

---

## Session 1 Summary

### Scope Freeze (at entry)
- DoD (from `handover/tasks/task.md`):
  - Mobile `<=390px` and desktop `>=1280px` checks pass.
  - Vercel deployment and environment configuration validated.
  - Principles gate passes with no unresolved blocker.
- Out of scope: new features/endpoints/tables, role model changes, CDN optimization, committing or pushing prior unpushed commits/work.

### Changes in This Session

#### Zoneless change-detection parity (inherited risk from generator4 session 2)
- `frontend/src/app/pages/home-page.component.ts`
  - Injected `ChangeDetectorRef`; `ngOnInit` and `logout()` now call `this.cdr.detectChanges()` in `finally` so async state (site settings fetch, logout navigation) renders under Angular 21 zoneless without stalling.
- `frontend/src/app/pages/register-page.component.ts`
  - Injected `ChangeDetectorRef`; `onSubmit` calls `this.cdr.detectChanges()` in `finally` so register error state and `isSubmitting` transition render consistently after async registration completes/fails.

Rationale: prior generator4 handover flagged missing `detectChanges()` on these two pages as a zoneless stuck-UI risk. Login, admin, and media pages already had the pattern; this brings home + register in line.

#### Responsive hardening at T-007 breakpoints
- `frontend/src/app/pages/login-page.component.ts`
  - Added `@media (max-width: 390px)` tightening: card padding 28→20, radius 18→14, heading 30→26, buttons height 44→46 for touch reach.
  - Added `@media (min-width: 1280px)` expanding card padding to 32 so the card does not feel cramped on wide viewports.
- `frontend/src/app/pages/register-page.component.ts`
  - Symmetrical 390/1280 breakpoints to match login-page.
- Home, showcase, media pages already had explicit 390/640/900/1280 breakpoints (generator3/generator4 sessions) and were verified unchanged.

#### Vercel/env documentation update
- `README.md`
  - Production Vercel env block now lists required `NANAMI_SUPABASE_URL`, `NANAMI_SUPABASE_ANON_KEY`, and `NODE_ENV=production` (the last one enforces fail-fast in `write-runtime-config.mjs`).
  - Smoke checklist extended with `/register`, `/manage-media`, responsive `<=390`/`>=1280` verification, and a role-matrix smoke step.
  - New **Required Env Matrix** table lists every env var, its scope (frontend build vs backend runtime), and purpose, so a fresh deployer sees the full contract in one place.

#### No changes needed (verified in place)
- `backend/.env.example` and `backend/.env.production.example` already exist with Supabase/CORS/session fields — no edit required.
- `frontend/vercel.json` already has SPA rewrites and `no-store` on `/runtime-config.js` — no edit required.
- Style tokens (generator3 R8 rule) are still the single source; no hardcoded color literals introduced this session.

### Files Changed
- `frontend/src/app/pages/home-page.component.ts`
- `frontend/src/app/pages/register-page.component.ts`
- `frontend/src/app/pages/login-page.component.ts`
- `README.md`

## Validation Evidence
- `backend npm test`: **39 passed, 0 failed** (no regressions from generator4 session 4 baseline + 1 new inherited settings test).
- `frontend npm run test:runtime-config`: **7/7 ok** (dev fallback + production fail-fast still enforced).
- `frontend npm run test:ci`: **36 Angular tests passed** (home-page/showcase/media/auth guard/navigation + runtime-config).
- `frontend npm run build`: pass — `main-*.js 337.20 kB`, `styles-*.css 4.07 kB`, initial transfer ~83 kB.

## Principles Gate (R1–R8 walkthrough)
- R1 Story Mapping: every changed file maps to T-007 hardening/deployment DoD.
- R2 Data Contract: no data model change.
- R3 Media Validation: unchanged (allowlist + size limits intact in backend).
- R4 Performance: first-screen unchanged; showcase still lazy-loads images and uses `preload=metadata` on video.
- R5 Responsive: home/showcase/media already verified; login/register now carry explicit `<=390` and `>=1280` breakpoints.
- R6 Security: no new storage path handling; `resolveStorageDeletePathFromPublicUrl` bucket-scoping still in place.
- R7 Role Authorization: `/admin` and `/manage-media` role guards unchanged.
- R8 Style Reuse: only style-token variables touched; no page-level hardcoded colors added.
- Gate outcome: **pass** (no unresolved blocker introduced).

## Unresolved Risks
- `detectChanges()` in the injection-context test path (`home-page.component.spec.ts` uses `TestBed.runInInjectionContext`) did not regress this run, but if future specs call `ngOnInit` on a detached view with a real `ChangeDetectorRef` and no host view, Angular may throw. Tests currently pass because TestBed provides a resolvable `ChangeDetectorRef` — if a test regresses with "Detached view", wrap the call in a component fixture instead of raw `new Component()`.
- 13 unpushed commits + inherited uncommitted work (generator4 session 2-5 diffs, media-page.component, DDL trace, sql folder) are still in the working tree. Generator7 intentionally did not commit or push them per scope freeze; release owner must decide when/whether to bundle or split them before deployment.
- DDL from [handover/sql/generator4-task4-media-updated-at.sql](../sql/generator4-task4-media-updated-at.sql) still must be applied in Supabase before production deploy, otherwise PATCH on `/api/admin/media/:id` will fail.
- Live Vercel deployment validation was not performed — evidence is local build + documented env matrix only. Release owner should run the updated smoke checklist on the real deploy.
- `backend/.env` continues to hold `SUPABASE_SERVICE_ROLE_KEY` locally; the root `.gitignore` already ignores `backend/.env`, but any new contributor must avoid `git add -A` to prevent staging untracked secret files in nearby directories.

## Decision
continue

## Follow-up Actions
- Evaluator7 runs A-007 against: responsive matrix at 390/1280 across all pages, principles gate R1-R8, Vercel env matrix completeness, smoke checklist coverage.
- Release owner: apply the pending SQL DDL, confirm all three frontend build env vars are set in Vercel, then run the extended smoke checklist (incl. `<=390`/`>=1280` + role matrix).
- Optional future hardening: convert `detectChanges()` `finally` pattern to Angular Signals / `AsyncPipe` + `ChangeDetectionStrategy.OnPush`, removing the blanket workaround.
