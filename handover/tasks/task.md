# Nanami Showcase Website - Master Task (GStack)

## Objective
Build a warm, media-first personal website to showcase the dog Nanami, with reliable image/video upload, lightweight content management, and safe public sharing.

## GStack Hierarchy

### G0 Mission
- Let visitors quickly understand Nanami's personality and daily life through stories, photos, and videos.

### G1 Product Pillars
- `P1 Storytelling`: Narrative homepage and timeline-like moments.
- `P2 Media Library`: Upload and browse Nanami photos/videos.
- `P3 Trust & Performance`: Fast loading, basic security, stable data access.
- `P4 Maintainability`: Clear ownership, repeatable release and review flow.

### G2 Capability Layers
- `L1 Experience Layer (Frontend Angular on Vercel)`:
  - Home hero, profile card, gallery, video section.
  - Responsive layout for mobile + desktop.
  - Upload UI and upload progress feedback.
- `L2 Platform Layer (Supabase)`:
  - Supabase Auth for admin login/session.
  - Supabase Postgres for media/settings metadata.
  - Supabase Storage for image/video assets.
- `L3 Delivery Layer (Vercel + Runtime Config)`:
  - Vercel deployment and environment variables.
  - Stable routing and public asset access strategy.
- `L4 Governance Layer (Harness Workflow)`:
  - Task split (generator/evaluator).
  - Principles gate (`standards/principles.md`).
  - Handover and release traceability.
- `L5 Data/Storage Convention`:
  - Store metadata for image/video assets in Postgres.
  - Define storage bucket/object key naming rules and URL mapping.
  - Keep schema simple and auditable.

### G3 Epics
- `E1` Access and role boundary (admin login and route guard).
- `E2` Public storytelling experience (homepage + showcase).
- `E3` Role and privilege management (Admin/Publisher/Viewer).
- `E4` Content management (upload/edit media and metadata).
- `E5` Site profile and settings.
- `E6` Security/performance hardening and release readiness.
- `E7` Mobile-first layout and visual polish.

### G4 Task Stories (Execution Order)
- `T-001` Login window (admin access entry via Supabase Auth).
- `T-002` Homepage (public intro page for Nanami).
- `T-003` Showcase page (public media display page).
- `T-004` Upload and edit interface (Supabase Storage + Postgres metadata management).
- `T-005` Info and settings page (site info/configuration persisted in Supabase Postgres).
- `T-006` Cross-cutting hardening and deployment (validation, responsive, performance, Vercel release).
- `T-007` Mobile experience refinement (phone layout correctness + elegant visual hierarchy).

### Task Revision Policy
- Baseline task IDs (`T-001` ... `T-007`) are immutable and must not be overwritten or repurposed.
- Incremental updates must use child task IDs, for example: `T-001-1`, `T-001-2`, `T-007-1`.
- Audit tasks follow the same rule: `A-001-1`, `A-007-1`, etc.
- Every child task must reference its parent baseline task and clearly state delta scope.

### G5 Per-Task Acceptance (DoD)
- `T-001`:
  - Login page route exists with form validation and error states.
  - Successful login via Supabase Auth protects admin routes.
- `T-002`:
  - Homepage renders Nanami profile, intro narrative, and entry links.
  - Public access without login.
- `T-003`:
  - Public timeline lists image/video metadata from Supabase Postgres. Delivered pivot: the timeline is embedded on the homepage under the `#story` anchor; the legacy `/showcase` route is kept as a redirect for bookmark compatibility.
  - Supports stable playback/viewing on modern browsers (image click opens an in-page lightbox; video uses `preload="metadata"`, `playsinline`, and controls).
  - Timeline merges `media_items` + `story_posts` (text entries) sorted by user-authored `display_date` desc with `created_at` tiebreak; paginated 10 per page.
  - Per-entry like counter is public and rate-limited per client IP (`LIKE_COOLDOWN_MS` per entry + `LIKE_MAX_PER_WINDOW` per window) to keep anonymous engagement possible while blocking abuse. Frontend dedupes with `localStorage` for UX only.
  - UI strings are translated EN/DE/ZH via `I18nService` + language picker; locale is persisted to `localStorage` and auto-detected from `navigator.language`.
- `T-004`:
  - Admin can upload image/video to Supabase Storage with title/description.
  - Admin can edit metadata and persist to Supabase Postgres.
  - Invalid file type/size is rejected with readable feedback.
- `T-005`:
  - Info/settings page allows editing site profile fields and preferences.
  - Settings changes are persisted in Supabase Postgres and reflected in UI.
- `T-006`:
  - Mobile (`<=390px`) and desktop (`>=1280px`) checks pass.
  - Vercel deployment and environment configuration are validated.
  - All DB migrations under `handover/sql/` are applied in documented order (see `README.md#database-migrations-supabase`); missing any migration must fail fast rather than silently.
  - Principles gate passes with no unresolved blocker.
- `T-007`:
  - Key routes (`/`, `/showcase`, `/login`, `/admin`, `/manage-media`) are fully usable on phone widths (`360px`, `390px`, `428px`).
  - No page-level horizontal scrolling on phone widths.
  - Primary interactive controls are touch-friendly (visually >= `44px` height where applicable).
  - Typography and spacing keep clear hierarchy and readable rhythm on small screens.
- `T-007-2`:
  - Each uploaded media row persists `file_size` so total storage usage can be summed server-side.
  - `/manage-media` surfaces a usage banner (`used / hard limit`, %, progress bar) for Admin/Publisher; changes colour when `STORAGE_SOFT_LIMIT_BYTES` is reached and switches to critical copy when `STORAGE_HARD_LIMIT_BYTES` is exceeded.
  - Backend `GET /api/admin/storage/usage` is role-gated and returns `{ usedBytes, softLimitBytes, hardLimitBytes, percentOfHard, status, trackedItems }`.
  - Banner refreshes after successful upload and delete so the number stays live; Supabase itself still enforces the real ceiling — the banner is an early warning, not a gatekeeper.

### G6 Design Child Tasks (No Baseline Override)
- `T-007-3` Hero entrance choreography:
  - Hero eyebrow/title/about/doodles animate in staged sequence on first load.
  - Includes reduced-motion fallback.
- `T-007-4` Hero parallax atmosphere:
  - Doodles/background layers receive subtle bounded parallax on scroll.
  - Must remain smooth on mid-range mobile devices.
- `T-007-5` Timeline stagger reveal:
  - Story/media cards reveal with stagger timing as they enter viewport.
  - Avoid excessive replay while scrolling.
- `T-007-6` Sticky glass navigation:
  - Top nav transitions into sticky glass style after scroll threshold.
  - Active section/link state remains clear.
- `T-007-7` Floating create action:
  - Homepage shows floating create/upload action for `Admin`/`Publisher` only.
  - Viewer role must not see create control.
- `T-007-8` Ambient gradient cycle:
  - Hero background adds slow warm atmospheric gradient movement.
  - Text contrast must stay readable.
- `T-007-9` Tactile media interaction:
  - Desktop media cards add subtle hover tilt/highlight.
  - Mobile adds press feedback instead of hover reliance.
- `T-007-10` Unified micro-interaction system:
  - Save/success/like/error interactions use consistent motion timing/easing tokens.
  - Interaction style is coherent across home/media/admin pages.

### G7 Maintenance Child Tasks (2026-07 Overhaul)
All entries are deltas under the Task Revision Policy; each references its parent baseline task.

- `A-006-1` (parent `T-006`) Full-stack maintenance audit (2026-07-24):
  - Whole-repo review of architecture completeness, security posture, test reality, and deploy health.
  - Findings drove every child task below; consolidated record in `handover/history.md` and `handover/public.md`.
- `T-006-1` (parent `T-006`) Supabase-only backend cleanup:
  - Removed dead local-Postgres auth surface (`/api/auth/register|login|session|logout`, `/api/db-check`, in-memory sessions, scrypt module, `docker-compose.yml`, `init-db`, `pg` dependency). `requireAuth` validates Supabase access tokens only.
  - 2026-07-28 follow-up: deleted unused `StoryTimelineComponent` (superseded by the homepage kite carousel) and the broken `#story` nav anchor.
- `T-003-1` (parent `T-003`) Anonymous engagement hardening:
  - Per-IP cooldown + window ceiling on anonymous comment POSTs (`429` + `Retry-After`), mirroring the existing like throttle; stale throttle state pruned.
  - New `entry_likes` table (`handover/sql/entry-likes-persistence.sql`, migration row 8) persists per-viewer like records across backend restarts; backend degrades to in-memory records while the migration is unapplied.
- `T-006-2` (parent `T-006`) Deploy, security, and free-tier operations:
  - Fixed hard 404s on direct SPA routes (`/login`, `/admin`): Vercel's current router drops the negative-lookahead rewrite and `cleanUrls` swallows the fallback; replaced with a plain catch-all and removed `cleanUrls`.
  - Hardened response headers (nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, HSTS); removed the `localStorage` runtime-config override channel (persistent redirect backdoor).
  - `keep-alive.yml` GitHub Action pings `/api/settings` every 10 minutes: keeps Render awake, keeps the Supabase free project active (it had paused unnoticed for ~3 months, taking the data layer down), and failure e-mails double as free uptime alerting.
- `T-001-1` (parent `T-001`) Resilient sessions:
  - Silent refresh-token exchange: proactive 5 minutes before expiry plus on-demand when an expired session is found; session clears only on refresh rejection.
  - Central `AuthService.apiFetch` injects the bearer token and retries exactly once after a 401-triggered refresh; all admin/media call sites migrated off hand-rolled `fetch`+`authHeaders`.
- `T-004-1` (parent `T-004`) Direct-to-storage uploads:
  - `POST /api/admin/media/upload-url` (signed URL) -> browser `PUT` straight to Supabase Storage -> `POST /api/admin/media/finalize` verifies object existence and true size before metadata insert.
  - Removes the base64-in-JSON detour that buffered files in backend memory and silently capped videos at ~48MB; legacy endpoint retained for compatibility.
- `T-006-3` (parent `T-006`) Frontend modernization:
  - Lazy-loaded `login`/`register`/`admin`/`manage-media` routes; initial bundle 452 -> 390 kB.
  - `admin-page`, `media-page`, `story-timeline`: inline templates/styles extracted to companion files; async state migrated to signals/`computed`; every manual `detectChanges()`/`markForCheck()` and the `ChangeDetectorRef` dependencies removed.
  - `home-page`: template extracted only — signal migration intentionally skipped (single CD call, event-driven state, animation-timing risk on the landing page).
  - `admin-page` test suite added (8 logic tests). Totals: backend 58, frontend 64.
- `T-002-1` (parent `T-002`) Public tech/colophon page:
  - New lazy `/tech` route linked from the homepage nav: stack + versions (Angular 21.2, TypeScript 5.9, Node 22 / Express 5.2), platforms (Supabase, Vercel, Render), tooling (GitHub Actions CI, Vitest + node:test, AI-assisted workflow), and creator credits with a source-repo link.
  - Fully translated EN/DE/ZH; spec asserts every key resolves in all three languages.
- `T-006-4` (parent `T-006`) Portfolio packaging:
  - README rebuilt as a showcase page (production screenshots via Playwright, mermaid architecture, engineering highlights, badges); `tests.yml` CI runs both suites + production build on every push; MIT `LICENSE`; developer/ops content split into `docs/DEVELOPMENT.md`.

## Definition of Done (Project)
- Tasks `T-001` to `T-007` are implemented and demoable.
- Principles check passes with no unresolved blocker.
- Basic test/audit evidence exists in handover outputs.

## Out of Scope (Current Phase)
- Complex permission matrix beyond `Admin` / `Publisher` / `Viewer`, and social login providers.
- Complex recommendation feeds.
- Real-time chat/live streaming.
- CDN auto-optimization pipeline (can be phase 2).
- Custom standalone backend API service (unless later required).

## Constraints
- Stack is fixed to current repo baseline:
  - Frontend: Angular, deployed on Vercel
  - Database: Supabase Postgres
  - Login/Auth: Supabase Auth
  - Image/Video: Supabase Storage
- Keep architecture simple and understandable for solo maintenance.
- All new work must map back to at least one G3 epic and one `T-xxx` task.
