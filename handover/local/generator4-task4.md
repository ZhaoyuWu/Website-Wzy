## Role
generator4

## Task
task4 — T-004 User Privilege Management (Admin / Publisher / Viewer)

## Target File
handover/local/generator4-task4.md

---

## Session 1 Summary (prior context — see original entry)

Architecture context: auth service is Supabase Auth based.
Role was initially read from `app_metadata.role` in Supabase JWT.
Backend `requireRole`, frontend `roleGuard`, admin page user management UI all delivered.
Tests passed: backend 27/27, frontend 27/27.

---

## Session 2 Summary (continuation fixes)

### Root cause discovered and fixed
Role was stored in Supabase `profiles` table (DB), but frontend/backend were reading from `app_metadata` (Auth), which was never populated. This caused all users to be treated as `Viewer` regardless of DB role.

### Backend changes (`backend/src/index.js`)
- `requireAuth` Supabase JWT path now queries `profiles` table via Supabase REST API to resolve role:
  ```
  GET /rest/v1/profiles?id=eq.{userId}&select=role&limit=1
  ```
  Role from DB takes precedence over `app_metadata.role` (which is left empty).
- `GET /api/admin/overview` response now includes `role: req.auth.role`.
- `backend/.env` — added `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (required for all Supabase REST calls including settings, media, and role lookup).

### Frontend changes
- `core/auth.service.ts`
  - `login()` now calls `refreshRoleFromBackend()` after Supabase auth.
  - `refreshRoleFromBackend()` calls `GET /api/admin/overview`, reads `role` from response, and overwrites the session snapshot stored in localStorage.
  - Result: session role reflects the DB `profiles.role`, not `app_metadata.role`.
- `pages/admin-page.component.ts`
  - Injected `ChangeDetectorRef`; all async methods (`ngOnInit`, `loadUsers`, `updateUserRole`, `claimAdminRole`, `uploadMedia`, `saveItem`, `loadMediaItems`, `loadSettings`, `saveSettings`) call `this.cdr.detectChanges()` in `finally` block.
  - Fix required because project has no zone.js (Angular 21 zoneless) — async fetch completions do not trigger change detection automatically.
  - Added `RouterLink` import; "← Home" button added to header.
  - File input `accept` attribute added: `image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime`.
- `pages/login-page.component.ts`
  - Default post-login redirect changed from `/admin` to `/`.
  - Injected `ChangeDetectorRef`; `finally` calls `detectChanges()`.
- `pages/home-page.component.ts`
  - "Admin" nav link and hero action renamed to "Settings".

### Supabase Storage bucket
- User created `media` bucket (Public) in Supabase Dashboard.
- Upload `POST /api/admin/media` now returns 201 with stored item.

## Validation Evidence
- Session 1: backend 27/27, frontend 27/27 (prior session)
- Session 2: `POST /api/admin/media` → `201 Created` confirmed in DevTools
- Upload UI: file selected → "Uploading..." shown → 201 received (detectChanges fix resolves stuck UI)
- Role resolution: `profiles.role = Admin` → backend reads via REST → `refreshRoleFromBackend` writes to session → Settings nav link appears on homepage

## Unresolved Risks
- `detectChanges()` in every `finally` is a blanket workaround | may suppress real reactivity bugs | consider migrating to Angular Signals in T-006 hardening
- Backend `.env` has `SUPABASE_SERVICE_ROLE_KEY` in plaintext | secret exposure if committed | confirm `.gitignore` covers `backend/.env`
- `refreshRoleFromBackend()` adds one extra round-trip on every login | minor latency | acceptable for current scale
- Zone.js absent: `home-page.component.ts` and `register-page.component.ts` async methods have no `detectChanges()` yet | may cause stuck UI on those pages | add in T-006

## Decision
continue

## Follow-up Actions
- Evaluator4 runs A-004 audit: Viewer blocked from `/admin`, Publisher sees upload, Admin sees full panel + role assignment
- T-006 hardening: add `detectChanges()` to remaining pages (home, register, showcase) or evaluate adding zone.js
- Confirm `backend/.env` is in `.gitignore` before any deployment
