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
  - Timeline merges `media_items` + `story_posts` (text entries) sorted by user-authored `display_date` desc with `created_at` tiebreak; paginated 20 per page.
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
