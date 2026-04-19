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

---

## Session 3 (this session) — Pre-release fixes, full release, and brand rebrand to nanami-live

### Trigger
User asked to "fix problems first, then release". Three feature/docs commits had been built on local `main` since the original Vercel + Render deploy and were sitting unreleased. User then asked the deployed URL be renamed from the random `frontend-six-snowy-32.vercel.app` to `nanami-live.vercel.app`.

### Pre-release fix commits (on `main`)
1. `15b638f fix(runtime): strip CLI quote wrappers and resolve Supabase config lazily`
   - `frontend/scripts/write-runtime-config.mjs` adds `normalizeArgToken()` to strip wrapping quotes — fixes the Windows/PowerShell case where Vercel build received `"--api-base-url=..."` and silently dropped the URL into the localhost fallback.
   - `frontend/src/app/core/auth.service.ts` resolves `supabaseUrl`/`supabaseAnonKey` lazily inside each method instead of capturing them at Angular service-construct time, which fired before `runtime-config.js` had loaded in some bootstrap orderings.
2. `26f33a4 docs(workflow): add T-007 mobile scope and codify child-ID revision policy`
   - `standards/principles.md` adds R5.1 Mobile Elegance and immutability of baseline task IDs.
   - All four `handover/tasks/*` workflow files widen scope from T-006 to T-007.
3. `837ca72 chore(backend): stop instantiating localhost PG Pool at module load`
   - Removed `require("./db")` and the `|| defaultPool` fallback in `createApp`. Deleted `backend/src/db.js`. Tests inject `dbPool` explicitly so `node --test backend/test/auth.test.js backend/test/media.test.js backend/test/settings.test.js` stays at 44/44 pass.
   - **Scope contraction note:** original plan was to also delete the legacy `/api/auth/{register,login,logout}` and `/api/db-check` routes, but the existing media/settings test suites depend on `/api/auth/login` to obtain Bearer tokens. Doing the full cleanup needs cross-file test rewrites; deferred as a tech-debt task.

### Pre-release Supabase schema probe (read-only)
Verified production Supabase already has every column/RPC/table the new feature commit needs — no DDL had to run to ship `c4e037d feat(T-003+T-004)`:

| Object | Probe result |
|---|---|
| `media_items.display_date` | 200 |
| `media_items.updated_at` | 200 |
| `media_items.likes_count` | 200 |
| `public.increment_media_likes(bigint)` | RPC reachable |
| `public.decrement_media_likes(bigint)` | RPC reachable |
| `public.story_posts` | exists with one seeded row |

### Trunk push
- Local `main` was 21 commits ahead of `origin/main` (the 18 task fixes from earlier in the day + my 3 above). Push was a fast-forward: `301799c..837ca72  main -> main`. No force needed.

### Release merge
- In `.release-worktree` (branch `online-release`): `git merge main --no-ff -m "Merge main into online-release for production deploy"` → merge commit `d1df942`. No conflicts (main commits never touched `render.yaml` / `vercel.json` / `runtime-config.js`; the release-only commits never touched the files main edited).
- Backend tests on the merged tree: `node --test backend/test/{auth,media,settings}.test.js` → 44/44 pass.
- `git push origin online-release` → `e8d4262..d1df942` → triggered Render auto-redeploy from the `branch: online-release` declaration in `render.yaml`.

### Frontend redeploy
- `npx vercel --prod --yes` from `.release-worktree/frontend` → deployment `dpl_6Y4Kp8cRfo8AaZwXiLHeowzJDUwB`-style URL, `readyState: READY`.
- Probed `https://frontend-six-snowy-32.vercel.app/runtime-config.js` and `/api/story/timeline` on Render to confirm new code surface is live (timeline endpoint is from `c4e037d`).

### Brand rebrand to nanami-live
1. `npx vercel project rename frontend nanami-live` → project slug changed.
2. `npx vercel alias set <latest-prod-deployment> nanami-live.vercel.app` → alias claimed (was free).
3. **Vercel Deployment Protection issue:** the new alias returned `401` because Vercel's Deployment Protection ("Vercel Authentication") only auto-bypasses the original `frontend-six-snowy-32.vercel.app` slug. Asked user to disable it via Settings → Deployment Protection → Vercel Authentication = Disabled. After user toggle, `nanami-live.vercel.app` returned `200`.
4. Updated `.release-worktree/render.yaml`: `CORS_ORIGIN_ALLOWLIST` from `https://frontend-six-snowy-32.vercel.app` → `https://nanami-live.vercel.app`. Commit `7ac08fe`, pushed → Render auto-redeployed; new CORS live within ~11s.
5. `npx vercel alias rm frontend-six-snowy-32.vercel.app --yes` → old alias removed; URL now returns 404. (Backend `nanami-backend.onrender.com` kept by user request.)

### Final Production State
- **Public entrypoint:** https://nanami-live.vercel.app (Vercel project `nanami-live`, was `frontend`)
- **Backend:** https://nanami-backend.onrender.com (Render free plan, Frankfurt, branch `online-release`)
- Runtime config served at `https://nanami-live.vercel.app/runtime-config.js`:
  - `apiBaseUrl = "https://nanami-backend.onrender.com"`
  - `supabaseUrl = "https://pltveorkgsxfccyuwidk.supabase.co"`
  - `supabaseAnonKey = "sb_publishable_ESrIEMrD1MFDAe_0rJ93Hw_2UNRaxJS"`
- CORS preflight from `nanami-live.vercel.app` → `204`, header `access-control-allow-origin: https://nanami-live.vercel.app`.
- Old `frontend-six-snowy-32.vercel.app` → `404`.

### Release Branch State (after Session 3)
- Branch: `online-release`
- Remote: `origin/online-release`
- Latest commits (top):
  - `7ac08fe` chore(deploy): point backend CORS at nanami-live.vercel.app
  - `d1df942` Merge main into online-release for production deploy
  - `837ca72` chore(backend): stop instantiating localhost PG Pool at module load
  - `26f33a4` docs(workflow): add T-007 mobile scope ...
  - `15b638f` fix(runtime): strip CLI quote wrappers ...

### Validation Evidence (Session 3)
- `git push origin main` → `301799c..837ca72  main -> main` (fast-forward, 21 commits).
- `git push origin online-release` → `e8d4262..d1df942` then `d1df942..7ac08fe`.
- Backend test suite on merged tree: `pass 44 / fail 0`.
- `curl https://nanami-live.vercel.app/runtime-config.js` → 200 with correct apiBaseUrl after Vercel Authentication was disabled.
- `curl -X OPTIONS https://nanami-backend.onrender.com/api/admin/overview -H "Origin: https://nanami-live.vercel.app" ...` → 204 with allow-origin echoed (post-redeploy poll converged in 11s).
- `curl https://frontend-six-snowy-32.vercel.app/runtime-config.js` → 404 (alias removed).
- `curl https://nanami-backend.onrender.com/api/story/timeline?page=1` → 200 with merged media + story rows (proves the merge of `c4e037d` reached Render).

### Unresolved Risks (after Session 3)
1. **Render free-plan cold start** — unchanged from Session 2; user opted to stay free for now. Mitigations remain: upgrade to Starter ($7/mo), or external keep-alive ping every 10–14 min, or accept.
2. **Legacy PG-only routes still in code** — `/api/auth/{register,login,logout}`, `/api/db-check` are present but unreachable in production (no `DATABASE_URL`); they would `TypeError` if invoked. Removal blocked on cross-file test rewrites in `media.test.js` / `settings.test.js`. Frontend never hits them.
3. **Admin password and Supabase service-role JWT in this file / on local disk** — same as Session 2; rotate via Supabase admin API if this file is ever shared publicly.
4. **Vercel Deployment Protection now globally disabled on the project** — every new preview/branch deployment is publicly accessible. If preview environments later host sensitive admin work, re-enable protection but add `nanami-live.vercel.app` to the bypass list explicitly.

### Next Actions
1. **Decide cold-start mitigation** — only outstanding production-quality knob.
2. **Tech-debt cleanup ticket** — fully remove the legacy PG-only routes, refactor `media.test.js` / `settings.test.js` `loginAndGetToken` helpers to use a Supabase-mocked auth fixture.
3. **Custom domain** — when DNS for a real `nanami` domain is set up, point Vercel at the apex/subdomain and Render at `api.<domain>`, update `NANAMI_API_BASE_URL` + `CORS_ORIGIN_ALLOWLIST`, redeploy.
4. **Rotate admin password** before sharing this handover externally.

---

## Operational Gotcha — `vercel --prod` does NOT rebind the public alias

**Symptom observed during the T-007-1 release:** after `npx vercel --prod --yes` from `.release-worktree/frontend`, the new deployment shipped READY (e.g. `nanami-live-keewsdyde-zhaoyu-privat.vercel.app`) but `https://nanami-live.vercel.app` kept serving the **previous** production deployment for ~30 minutes. The new deploy auto-aliased to `nanami-live-zhaoyu-privat.vercel.app` and `nanami-live-zhaoyuwu1993-2713-zhaoyu-privat.vercel.app`, but **not** to the `nanami-live.vercel.app` short alias users actually visit.

**Root cause:** `nanami-live.vercel.app` is a custom alias (set via `vercel alias set`) and Vercel does not automatically re-point custom aliases on subsequent prod deploys — only the auto-generated team/project aliases follow.

**Fix every time after `vercel --prod`:**
```bash
# 1. Find the deployment id from `vercel ls --prod` (top row)
# 2. Rebind the public alias
npx vercel alias set <new-deployment>.vercel.app nanami-live.vercel.app
```

**Side effect to clean up:** Each prod deploy also resurrects the `frontend-six-snowy-32.vercel.app` legacy alias (Vercel re-creates it from the original project slug). If keeping the brand clean, run after every deploy:
```bash
npx vercel alias rm frontend-six-snowy-32.vercel.app --yes
```

**Suggested deploy script (manual until automated):**
```bash
cd .release-worktree/frontend
npx vercel --prod --yes
DEP=$(npx vercel ls --prod 2>&1 | awk '/Production/ && NR<8 {print $4; exit}')
npx vercel alias set "$DEP" nanami-live.vercel.app
npx vercel alias rm frontend-six-snowy-32.vercel.app --yes 2>/dev/null || true
```

**Verification one-liner:**
```bash
curl -s "https://nanami-live.vercel.app/runtime-config.js?t=$(date +%s)" | head -2
npx vercel alias ls | head -5   # confirm nanami-live.vercel.app source = new deployment
```
