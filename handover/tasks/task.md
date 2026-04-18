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
- `E3` Content management (upload/edit media and metadata).
- `E4` Site profile and settings.
- `E5` Security/performance hardening and release readiness.

### G4 Task Stories (Execution Order)
- `T-001` Login window (admin access entry via Supabase Auth).
- `T-002` Homepage (public intro page for Nanami).
- `T-003` Showcase page (public media display page).
- `T-004` Upload and edit interface (Supabase Storage + Postgres metadata management).
- `T-005` Info and settings page (site info/configuration persisted in Supabase Postgres).
- `T-006` Cross-cutting hardening and deployment (validation, responsive, performance, Vercel release).

### G5 Per-Task Acceptance (DoD)
- `T-001`:
  - Login page route exists with form validation and error states.
  - Successful login via Supabase Auth protects admin routes.
- `T-002`:
  - Homepage renders Nanami profile, intro narrative, and entry links.
  - Public access without login.
- `T-003`:
  - Showcase page lists image/video metadata from Supabase Postgres.
  - Supports stable playback/viewing behavior on modern browsers.
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
  - Principles gate passes with no unresolved blocker.

## Definition of Done (Project)
- Tasks `T-001` to `T-006` are implemented and demoable.
- Principles check passes with no unresolved blocker.
- Basic test/audit evidence exists in handover outputs.

## Out of Scope (Current Phase)
- Multi-user role system and social login providers.
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
