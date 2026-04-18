## Role
producer

## Target File
handover/local/generator.md

## Summary Written
- Completed local handover update for dev/prod environment split requested after `T-006`.
- Backend environment templates:
  - Expanded `backend/.env.example` with development + production-ready variable set and guidance.
  - Added `backend/.env.production.example` for hosted deployment baseline.
- Frontend runtime-config workflow:
  - Added generator script `frontend/scripts/write-runtime-config.mjs`.
  - Updated `frontend/package.json` scripts so:
    - `npm start` writes dev runtime config (`http://localhost:4000`) then starts Angular.
    - `npm run build` writes runtime config from env (`NANAMI_API_BASE_URL`/`API_BASE_URL`) before build.
  - Updated `frontend/public/runtime-config.js` default to local dev API.
  - Added examples:
    - `frontend/public/runtime-config.development.example.js`
    - `frontend/public/runtime-config.production.example.js`
- Documentation:
  - Reworked root `README.md` into explicit development vs production operation guide.
  - Added concrete steps for local full-stack testing and Vercel production rollout.

## Files changed in this iteration
- `backend/.env.example`
- `backend/.env.production.example`
- `frontend/scripts/write-runtime-config.mjs`
- `frontend/package.json`
- `frontend/public/runtime-config.js`
- `frontend/public/runtime-config.development.example.js`
- `frontend/public/runtime-config.production.example.js`
- `README.md`

## Validation Evidence
- `npm.cmd run config:runtime:dev` (frontend): passed, runtime file generated with `apiBaseUrl=http://localhost:4000`.
- `npm.cmd run test:ci` (frontend): passed, `24/24` tests green.
- `npm.cmd run build` (frontend): passed, runtime-config generation + Angular production build completed.

## Unresolved Risks
- Backend still depends on `SUPABASE_SERVICE_ROLE_KEY`; if missing/invalid, admin media/settings APIs fail at runtime | ensure deployment secrets are configured before release.
- Session storage is still in-memory (`Map`) | restart invalidates sessions and does not support multi-instance deployment.
- If Vercel env var `NANAMI_API_BASE_URL` is not configured, production build will default runtime config to localhost | set env var in Vercel project before production deploy.

## Decision
continue

## Follow-up Actions
- Evaluator executes `A-006` final release gate with principles verdict (`pass/fail`) and go/no-go recommendation.
- Configure `NANAMI_API_BASE_URL` in Vercel and run post-deploy smoke checks (`/`, `/showcase`, `/login`, `/admin`).
- If production rollout targets multiple backend instances, move session storage from in-memory map to shared store.
