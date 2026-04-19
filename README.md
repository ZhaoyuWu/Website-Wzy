# Website 1st

Full-stack starter:
- Frontend: Angular (`frontend`)
- Backend: Node.js + Express (`backend`)
- Database: PostgreSQL (`docker-compose.yml`)

## Harness Commands (No Skill Index Required)

In this project root, run:

```bash
npm run harness:help
```

Run a specific workflow command:

```bash
npm run generator -- "Implement login API for users"
npm run evaluator -- "Audit story US-001"
npm run verify-thorough -- "Verify backend auth flow"
```

These commands read from `.claude/commands/*.md` and render the template locally.

## Environment Strategy

Use two environments:
1. `development` (local full-stack testing)
2. `production` (Vercel frontend + hosted backend + hosted DB/Supabase)

## Development (Local)

### 1) Backend env
1. Copy `backend/.env.example` to `backend/.env`.
2. Fill local DB and optional Supabase values.

### 2) Start PostgreSQL
Use Docker:

```bash
docker compose up -d
```

Or native PostgreSQL:
1. Install PostgreSQL and keep it running on `5432`.
2. Update `backend/.env` DB fields.
3. Initialize schema:

```bash
cd backend
npm run db:init
```

### 3) Start backend

```bash
cd backend
npm run dev
```

Backend checks:
1. `GET http://localhost:4000/api/health`
2. `GET http://localhost:4000/api/db-check`

### 4) Start frontend

```bash
cd frontend
npm start
```

`npm start` auto-writes `frontend/public/runtime-config.js` with:
- `apiBaseUrl = http://localhost:4000`

Frontend URL:
1. `http://localhost:4200`

## Production (Vercel + Hosted Backend)

### 1) Backend production env
1. Use `backend/.env.production.example` as template.
2. Set all secrets in your backend host environment UI (do not commit real values).
3. Ensure `CORS_ORIGIN_ALLOWLIST` includes your Vercel frontend domain.
4. Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.

### 2) Frontend on Vercel
1. Set project root to `frontend/`.
2. Keep `frontend/vercel.json` enabled (SPA rewrite + runtime config no-store).
3. In Vercel env vars, set:
   - `NANAMI_API_BASE_URL=https://your-backend.example.com`
4. Build command stays `npm run build` (it auto-generates runtime-config using env var, and fails fast in production if the API URL is missing/invalid).

### 3) Runtime config behavior
Frontend API base priority:
1. `window.__NANAMI_APP_CONFIG__.apiBaseUrl`
2. `window.API_BASE_URL` / `window.NANAMI_API_BASE_URL`
3. `localStorage.API_BASE_URL`
4. fallback `http://localhost:4000`

## Deploy Smoke Checklist
1. Open `/`, `/login`, `/register`, `/admin`, `/manage-media` directly with hard refresh. The homepage renders the story timeline inline (anchor `#story`); `/showcase` is kept as a legacy redirect to `/`.
2. Confirm homepage `/api/settings` and `/api/story/timeline` calls go to the production backend domain.
3. Confirm admin login, media upload with required display date, metadata edit, settings save, and story-text post publish all work.
4. Responsive check: verify homepage, timeline, login, register at `<=390px` and `>=1280px` breakpoints.
5. Role matrix: Viewer blocked from `/admin` and `/manage-media`; Publisher/Admin can reach media; Admin can reach settings.
6. Likes throttle sanity: rapidly toggling the same entry returns `429` with a `Retry-After` header after the cooldown/window ceiling.

## Database Migrations (Supabase)

Apply the SQL files in `handover/sql/` in this order before a fresh deploy or when pulling a new release. Each file is idempotent (`IF NOT EXISTS` / defensive updates).

| Order | File | Purpose |
| --- | --- | --- |
| 1 | `generator1-task1-supabase-ddl.sql` | Base schema: `profiles`, `media_items`, `site_settings`. |
| 2 | `generator4-task4-media-updated-at.sql` | Adds `media_items.updated_at` for edit-time display. |
| 3 | `generator3-task3-media-likes.sql` | Adds `media_items.likes_count` + increment/decrement RPCs. |
| 4 | `generator3-task3b-story-timeline.sql` | Adds `story_posts` (+ RPCs) and forward-compatible `story_comments`. |
| 5 | `generator4-task4-display-date.sql` | Adds `display_date` to `media_items` and `story_posts` for user-authored timeline ordering. |

Missing any of 2–5 will cause `/api/story/timeline`, `POST /api/admin/media`, or admin story-post CRUD to 500 in production.
