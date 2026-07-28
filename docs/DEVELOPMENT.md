# Development Guide

Setup, operations, and deployment reference. For the project overview see the [README](../README.md).

## Environment strategy

Two environments:

1. `development` — local frontend + local backend, both talking to the cloud Supabase project
2. `production` — Vercel (frontend) + Render (backend) + Supabase (auth/database/storage)

There is no local database: auth, data, and storage live in Supabase in every environment.

## Local development

### 1) Backend

```bash
cd backend
cp .env.example .env    # fill SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm ci
npm run dev             # http://localhost:4000
```

Health check: `GET http://localhost:4000/api/health`

### 2) Frontend

```bash
cd frontend
npm ci
npm start               # http://localhost:4200
```

`npm start` auto-writes `frontend/public/runtime-config.js` pointing at `http://localhost:4000`.

### 3) Tests

```bash
cd backend  && npm test          # node:test
cd frontend && npm run test:ci   # vitest
```

## Runtime configuration

Frontend API base priority:

1. `window.__NANAMI_APP_CONFIG__.apiBaseUrl`
2. `window.API_BASE_URL` / `window.NANAMI_API_BASE_URL`
3. fallback `http://localhost:4000`

`localStorage` overrides are intentionally not supported: a persistent writable
override could permanently redirect API calls (with auth headers) to a hostile
host after a single XSS or shared-device tamper.

In production the config file is generated at build time from Vercel env vars
(`NANAMI_API_BASE_URL`, `NANAMI_SUPABASE_URL`, `NANAMI_SUPABASE_ANON_KEY`);
the build fails fast if the API URL is missing.

## Database migrations (Supabase)

Apply the SQL files in `handover/sql/` in this order on a fresh Supabase
project. Each file is idempotent (`IF NOT EXISTS` / defensive updates).

| Order | File | Purpose |
| --- | --- | --- |
| 1 | `generator1-task1-supabase-ddl.sql` | Base schema: `profiles`, `media_items`, `site_settings`. |
| 2 | `generator4-task4-media-updated-at.sql` | Adds `media_items.updated_at` for edit-time display. |
| 3 | `generator3-task3-media-likes.sql` | Adds `media_items.likes_count` + increment/decrement RPCs. |
| 4 | `generator3-task3b-story-timeline.sql` | Adds `story_posts` (+ RPCs) and `story_comments`. |
| 5 | `generator4-task4-display-date.sql` | Adds `display_date` for user-authored timeline ordering. |
| 6 | `generator7-task7-2-storage-quota.sql` | Adds `media_items.file_size` for the storage-usage banner. |
| 7 | `generator3-task3-showcase-comments.sql` | Creates the legacy `showcase_comments` table. |
| 8 | `entry-likes-persistence.sql` | Adds `entry_likes` so per-viewer like records survive backend restarts (non-breaking if missing: backend falls back to in-memory records). |

## Deployment

- **Backend**: push to `online-release` — Render auto-deploys via `render.yaml`
  (branch binding, health check on `/api/health`).
- **Frontend**: `npx vercel --prod` from `frontend/`, then re-point the public
  alias — Vercel does **not** move custom aliases automatically:

  ```bash
  npx vercel alias set <new-deployment>.vercel.app nanami-live.vercel.app
  ```

- **Keep-alive / alerting**: `.github/workflows/keep-alive.yml` pings the
  backend every 10 minutes from the `main` branch. This keeps the Render free
  instance awake, keeps the Supabase free project active (they pause after 7
  idle days), and failed runs trigger GitHub's failure e-mail — free uptime
  alerting.

## Deploy smoke checklist

1. Open `/`, `/login`, `/register`, `/admin`, `/manage-media` directly with a hard refresh.
2. Confirm `runtime-config.js` points at the production backend.
3. Admin login, media upload (direct-to-storage), metadata edit, settings save, story-post publish.
4. Responsive check at <=390px and >=1280px.
5. Role matrix: Viewer blocked from `/admin` and `/manage-media`; Publisher/Admin can reach media; Admin can reach settings.
6. Rate limits: rapid like/comment repeats return `429` with a `Retry-After` header.
