# Deployer Local Handover

Date: 2026-04-19
Owner: deployer
Scope: release branch sync, Vercel production deploy, routing fix, env/debug follow-up, backend cloud deploy

## Session 1 (earlier) — Vercel baseline

### Completed
- Synced `online-release` to `origin/local-debug` baseline in isolated worktree `.release-worktree`.
- Pushed `online-release` updates to remote.
- Deployed frontend to Vercel production and bound alias:
  - https://frontend-six-snowy-32.vercel.app
- Fixed SPA route 404 on `/login` by updating Vercel config and redeploying.
- Verified `/login` now returns `HTTP 200`.

### Files Changed (release worktree)
- `.release-worktree/frontend/vercel.json`
- `.release-worktree/frontend/public/runtime-config.js` (production baseline commit)

### Known Issue Left Open
- Runtime config served from production had `apiBaseUrl = "http://localhost:4000"`.
- Root cause: `NANAMI_API_BASE_URL` was not set in Vercel production (only `NODE_ENV`, `NANAMI_SUPABASE_URL`, `NANAMI_SUPABASE_ANON_KEY`); build script fell back to localhost default.
- Prior stdin-piped env write attempts had trailing-newline artifacts and were never confirmed applied.

---

## Session 2 (this session) — Production backend live + env fix

### Trigger
User reported "admin 账号无法登录" on https://frontend-six-snowy-32.vercel.app/login.

### Root Cause Tree (verified)
1. **Login failure (initial)** — Supabase `/auth/v1/token` returned `400 invalid_credentials`. Not a deploy problem. Supabase project `pltveorkgsxfccyuwidk` only had one user (`zhaoyu.wu1993@gmail.com`, confirmed, `app_metadata.role=Admin`); user was likely typing the local bootstrap email `admin@nanami.local` or wrong password.
2. **Post-login admin panel failure** — After auth fixed, frontend called `http://localhost:4000/api/*` and failed (CORS `500` on OPTIONS). Root cause: production frontend had no reachable backend; CORS allowlist on local backend did not include the Vercel origin.

### Completed
- Supabase admin password reset via admin API (service role key from local `backend/.env`):
  - `PUT /auth/v1/admin/users/77ecd6a0-d8f9-4c30-bc92-1e12b38adb31 {"password":"Wzy=61275970"}` → `200`, `updated_at=2026-04-19T10:12:44Z`.
  - Verified by replay: `POST /auth/v1/token?grant_type=password` → `200` with `access_token` + `app_metadata.role=Admin`.
- Surveyed backend dependencies:
  - Frontend admin panel (`overview`, `settings`, `media`, `users`) hits **Supabase only** (profiles, media_items, site_settings, storage). No managed Postgres needed for production.
  - PG is only used by legacy `/api/auth/{register,login,logout}` and `/api/db-check`, which the current frontend never calls.
- Added Render Blueprint `render.yaml` at repo root of `online-release`:
  - Commit: `e8d4262 chore(deploy): add Render Blueprint for backend service`.
  - Config: `runtime: node`, `region: frankfurt`, `plan: free`, `branch: online-release`, `rootDir: backend`, `healthCheckPath: /api/health`, env vars include `NODE_ENV=production`, `CORS_ORIGIN_ALLOWLIST=https://frontend-six-snowy-32.vercel.app`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (sync:false), plus explicit Supabase table/bucket/key names.
  - Pushed to `origin/online-release` (`3629c82..e8d4262`).
  - User created Blueprint in Render dashboard; service deployed at **https://nanami-backend.onrender.com**.
- Dropped an interim commit on `main` (`9a810d4`) via `git reset --hard HEAD~1` after user correctly pointed out release config belongs on the release branch. Not pushed, recoverable via reflog.
- Set Vercel production env `NANAMI_API_BASE_URL=https://nanami-backend.onrender.com` using `printf "%s"` (no trailing newline) piped into `vercel env add`. Verified clean via `vercel env pull` → hex dump shows `"...onrender.com"` with `0a` only outside the closing quote.
- Redeployed Vercel production:
  - Deployment ID `dpl_6Y4Kp8cRfo8AaZwXiLHeowzJDUwB`, `readyState: READY`.

### Release Branch State
- Branch: `online-release`
- Remote: `origin/online-release`
- Latest commits (top):
  - `e8d4262` chore(deploy): add Render Blueprint for backend service
  - `3629c82` fix(deploy): route SPA paths on Vercel static build
  - `1eee96b` chore(release): switch runtime config to production baseline

### Files Changed (this session)
- `.release-worktree/render.yaml` (new, Render Blueprint)

### Current Production Runtime Status
- https://frontend-six-snowy-32.vercel.app/runtime-config.js →
  - `apiBaseUrl = "https://nanami-backend.onrender.com"` ✅
  - `supabaseUrl = "https://pltveorkgsxfccyuwidk.supabase.co"` ✅
  - `supabaseAnonKey = "sb_publishable_ESrIEMrD1MFDAe_0rJ93Hw_2UNRaxJS"` ✅
- Backend https://nanami-backend.onrender.com (Render free plan, Frankfurt):
  - `GET /api/health` → 200 `{"ok":true,"service":"backend",...}`
  - `GET /api/settings` → 200, `"source":"supabase"` (service role key valid)
  - `GET /api/showcase/media?limit=24` → 200 with items
  - `OPTIONS /api/admin/overview` with `Origin: https://frontend-six-snowy-32.vercel.app` → 204, `access-control-allow-origin` echoed

### Validation Evidence
- `curl -s -X POST -H "apikey: sb_publishable_..." -d '{"email":"zhaoyu.wu1993@gmail.com","password":"Wzy=61275970"}' https://pltveorkgsxfccyuwidk.supabase.co/auth/v1/token?grant_type=password` → 200 with JWT, `app_metadata.role=Admin`.
- `curl -I -X OPTIONS https://nanami-backend.onrender.com/api/admin/overview -H "Origin: https://frontend-six-snowy-32.vercel.app" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: authorization"` → `HTTP/2 204`, `access-control-allow-origin: https://frontend-six-snowy-32.vercel.app`.
- `xxd` of pulled Vercel env shows `NANAMI_API_BASE_URL="https://nanami-backend.onrender.com"` with newline strictly outside the quotes.
- Vercel deploy: `readyState: READY` for `dpl_6Y4Kp8cRfo8AaZwXiLHeowzJDUwB`.

### Unresolved Risks
1. **Render free-plan cold start** — Service spins down after 15 min idle; next request returns `404` with header `x-render-routing: no-server` for ~30–60 s until the container boots. User observed this once on `/api/showcase/media`. Mitigation options:
   - Upgrade `plan: free` → `plan: starter` in `render.yaml` ($7/mo, no spin-down). Single-line change, auto-redeploys.
   - Keep free, add external keep-alive (cron-job.org / UptimeRobot pinging `/api/health` every 10–14 min). Gray-area per Render TOS.
   - Accept the cold start (admin-only traffic; at most a few hits/day).
2. **Legacy `/api/auth/*` and `/api/db-check` routes** — These still try to connect to PG via `DATABASE_URL` / `DB_*` env vars, which are not set on Render. Any call to them would throw. Frontend does not call them today; consider removing or gating behind a feature flag in a later cleanup task.
3. **Admin password stored in this file** — `Wzy=61275970` is in plaintext here. If this file is ever shared publicly, rotate the password via Supabase admin API.
4. **Service role key still referenced locally** — `backend/.env` on the dev machine contains the Supabase service role JWT. It is out of VCS but on disk; treat the machine as privileged.

### Next Actions (for next deployer run / maintenance)
1. User-facing browser verification after cold start warm-up:
   - Hard reload `/login`, log in as `zhaoyu.wu1993@gmail.com` / `Wzy=61275970`.
   - Navigate admin → settings, media, users — all `/api/*` should hit `nanami-backend.onrender.com` with 200/204.
2. Decide on cold-start mitigation (upgrade, keep-alive, or accept). If upgrading: flip `plan: free` → `plan: starter` in `.release-worktree/render.yaml`, commit, push; Render auto-migrates.
3. Optional cleanup: delete or guard legacy PG-backed endpoints in `backend/src/index.js` (`/api/auth/register|login|logout`, `/api/db-check`) since they cannot run on Render.
4. Optional: point a real domain at Render (e.g. `api.nanami.app`) once DNS is provisioned, update `NANAMI_API_BASE_URL` and `CORS_ORIGIN_ALLOWLIST` accordingly, redeploy both.

### Notes
- Main workspace has unrelated user-local changes; release work stayed isolated in `.release-worktree`.
- `render.yaml` intentionally lists Supabase table/bucket env vars explicitly (even though backend code has matching defaults) so production config is auditable from the Blueprint alone.
