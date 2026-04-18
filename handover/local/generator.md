## Role
producer

## Target File
handover/local/generator.md

## Summary Written
- Completed `T-006` cross-cutting hardening and release-readiness sweep.
- Frontend runtime-config hardening:
  - Added shared runtime resolver (`frontend/src/app/core/runtime-config.ts`) with precedence:
    1) `window.__NANAMI_APP_CONFIG__.apiBaseUrl`,
    2) `window.API_BASE_URL` / `window.NANAMI_API_BASE_URL`,
    3) `localStorage.API_BASE_URL`,
    4) fallback `http://localhost:4000`.
  - Removed localhost coupling from auth/settings API calls:
    - `frontend/src/app/core/auth.service.ts`
    - `frontend/src/app/pages/home-page.component.ts`
  - Added runtime-config asset and boot-time injection:
    - `frontend/public/runtime-config.js`
    - `frontend/src/index.html` loads `/runtime-config.js`.
- Responsive fixes (`<=390px` and `>=1280px`) and media-list paint optimization:
  - `frontend/src/app/pages/home-page.component.ts`
  - `frontend/src/app/pages/showcase-page.component.ts`
  - `frontend/src/app/pages/admin-page.component.ts`
  - Added tighter small-screen controls and large-screen spacing/grid improvements.
  - Added `content-visibility: auto` + `contain-intrinsic-size` on repeated cards/rows to reduce first-screen rendering cost.
- Vercel deployment readiness:
  - Added `frontend/vercel.json` with SPA rewrite and `runtime-config.js` no-store cache policy.
  - Updated root release notes/checklist (`README.md`) for Vercel root path, backend env, CORS allowlist, and smoke checks.
- Added regression tests for runtime API-base behavior:
  - `frontend/src/app/core/auth.service.spec.ts`
  - `frontend/src/app/pages/home-page.component.spec.ts`

## Files changed in this iteration
- `frontend/public/runtime-config.js`
- `frontend/vercel.json`
- `frontend/src/index.html`
- `frontend/src/app/core/runtime-config.ts`
- `frontend/src/app/core/auth.service.ts`
- `frontend/src/app/core/auth.service.spec.ts`
- `frontend/src/app/pages/home-page.component.ts`
- `frontend/src/app/pages/home-page.component.spec.ts`
- `frontend/src/app/pages/showcase-page.component.ts`
- `frontend/src/app/pages/admin-page.component.ts`
- `README.md`

## Validation Evidence
- `npm.cmd test` (backend): passed, `27/27` tests green.
- `npm.cmd run test:ci` (frontend): passed, `24/24` tests green.
- `npm.cmd run build` (frontend): passed, Angular production build completed.

## Unresolved Risks
- Backend still depends on `SUPABASE_SERVICE_ROLE_KEY`; if missing/invalid, admin media/settings APIs fail at runtime | ensure deployment secrets are configured before release.
- Session storage is still in-memory (`Map`) | restart invalidates sessions and does not support multi-instance deployment.
- `runtime-config.js` must be configured per environment; if left empty, frontend falls back to localhost and admin/public API calls fail in production.

## Decision
continue

## Follow-up Actions
- Evaluator executes `A-006` full release gate with principles verdict (`pass/fail`) and go/no-go recommendation.
- If production rollout targets multiple backend instances, move session storage from in-memory map to shared store.
