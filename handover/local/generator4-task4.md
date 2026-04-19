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

---

## Session 3 Summary (restructure: dedicated Media Management page)

### Scope directive
Move media upload out of the settings/admin page into a dedicated page linked from the homepage nav. List existing media as title + upload-time only, with a per-row delete. Metadata edit is dropped.

### Backend changes (`backend/src/index.js`)
- Added `DELETE /api/admin/media/:id` (requires `Admin` or `Publisher`):
  1. Look up the row (`public_url`) via Supabase REST.
  2. Parse the object path from `public_url` (substring after `/storage/v1/object/public/`) and `DELETE /storage/v1/object/<bucket>/<path>` — 404 on storage is tolerated so an orphaned row can still be cleaned.
  3. `DELETE /rest/v1/media_items?id=eq.<id>` with `Prefer: return=representation`.
- Returns `{ ok: true, id }` on success, `404` when the row does not exist.

### Backend tests (`backend/test/media.test.js`)
- Added `delete endpoint removes storage object and metadata row` — asserts both storage and metadata DELETE calls fire.
- Added `delete endpoint returns 404 when media id is missing` — asserts lookup returns `[]` path.

### Frontend changes
- `pages/media-page.component.ts` (new) — standalone component at route `/manage-media`:
  - Upload form (title + optional description + file, same validation as before).
  - Existing media rendered as simple list: `title` + `created_at` formatted via `toLocaleString()` + Delete button (with `confirm()` prompt).
  - Delete calls `DELETE /api/admin/media/:id`, removes the row from local state on success.
  - `ChangeDetectorRef` called in every async `finally` (consistent with admin-page zoneless workaround).
- `app.routes.ts` — registered `manage-media` path with `roleGuard('Admin', 'Publisher')`.
- `pages/home-page.component.ts` — nav and hero now show a "Media" link for Admin/Publisher alongside "Settings".
- `pages/admin-page.component.ts` — removed upload form, media list, metadata edit, and all supporting helpers (`uploadMedia`, `saveItem`, `loadMediaItems`, `fileToBase64`, `inferMediaType`, `formatSize`, related state and styles). Replaced with a short link section pointing to `/manage-media`.

### Trade-offs / deviations
- **Metadata edit removed**: the original T-004 DoD included "Admin can edit metadata and persist to Supabase Postgres". The new scope directive replaces edit with delete. Backend `PATCH /api/admin/media/:id` is still available and tested, but is unreachable from the UI.
- **No thumbnails in list**: matches the new "only title and time" directive.

## Validation Evidence
- `backend npm test`: `37 passed, 0 failed` (includes the two new DELETE tests).
- `frontend npm run test:ci`: `runtime-config 7/7` + `28 Angular tests` pass.
- `frontend npm run build`: succeeded (`main-*.js 332.89 kB`).

## Unresolved Risks
- `DELETE` endpoint does not verify the extracted storage path belongs to the configured bucket before deleting — a tampered `public_url` row could address other buckets | low risk in practice because rows are written by the trusted POST path, but worth hardening if row inserts are ever exposed to untrusted clients.
- No `confirm()` fallback for headless/test browsers; the component short-circuits to delete if `window.confirm` is missing.
- Evaluator A-004 matrix previously covered `/admin` role boundary; now also needs `/manage-media` route guard + delete permission verification (Viewer should be blocked, Publisher/Admin pass).

---

## Session 4 Summary (re-add edit + surface update time)

### Scope directive
Re-introduce metadata editing on the `/manage-media` page (title + description) and display the last-update time alongside the upload time.

### DDL change — **RUN IN SUPABASE BEFORE DEPLOY**
Migration file: [handover/sql/generator4-task4-media-updated-at.sql](../sql/generator4-task4-media-updated-at.sql)

```sql
alter table public.media_items
  add column if not exists updated_at timestamptz;
update public.media_items set updated_at = created_at where updated_at is null;
alter table public.media_items
  alter column updated_at set default now(),
  alter column updated_at set not null;
```

Rationale: existing `media_items` schema has no `updated_at` column. Three-step apply keeps the ALTER non-blocking and seeds historical rows to `created_at` so the UI does not show them as "edited just now".

### Backend changes (`backend/src/index.js`)
- `listMediaItems` now selects `updated_at` alongside `created_at`; the showcase and admin endpoints both return it automatically.
- `PATCH /api/admin/media/:id` now writes `updated_at: new Date().toISOString()` into the Supabase PATCH body regardless of DB triggers, so the timestamp changes on every edit.

### Backend test (`backend/test/media.test.js`)
- Added `metadata patch endpoint stamps updated_at on every edit` — captures the PATCH body sent to Supabase and asserts `updated_at` is a valid ISO timestamp; also asserts the response carries `updated_at`.

### Frontend changes (`frontend/src/app/pages/media-page.component.ts`)
- Row now shows `Uploaded: <created_at>` always and `Updated: <updated_at>` only when `updated_at !== created_at` (via `hasBeenEdited`), so pristine rows stay visually clean.
- Added inline Edit mode: per-row `Edit` button opens a title + description form; `Save` calls existing `PATCH /api/admin/media/:id`; `Cancel` discards the draft. Delete remains on the non-edit view.
- Save flow merges the server response back into the local row (`{ ...current, ...saved }`) so the new `updated_at` appears without a full refresh.
- State additions: `editingId`, `editDraft`, `isSavingEdit`, `editError`.

## Validation Evidence
- `backend npm test`: `38 passed, 0 failed` (includes new updated_at stamp test).
- `frontend npm run test:ci`: `runtime-config 7/7` + `28 Angular tests` pass.
- `frontend npm run build`: pass (main bundle `336.38 kB`).

## Unresolved Risks (additional)
- DDL must be applied in Supabase before deploying this backend, otherwise PATCH will fail with "column does not exist".
- The edit UI does not show a live "updated moments ago" indicator; display refresh relies on `toLocaleString()` which uses the browser locale.

## Decision
continue

## Follow-up Actions
- Apply `handover/sql/generator4-task4-media-updated-at.sql` in Supabase prior to redeploy.
- Evaluator4 runs A-004 audit against new layout: `/manage-media` reachable only by Admin/Publisher, upload works, list shows title + uploaded + updated (only when edited), edit persists and surfaces new update time, delete removes both storage object and row.
- T-006 hardening: add `detectChanges()` to `home-page` and `register-page`, or evaluate re-adding zone.js.
- Confirm `backend/.env` is in `.gitignore` before deployment.

---

## Session 5 Summary (compact horizontal row layout)

### Scope directive
User feedback: 紧凑一点,横向排布元素 — existing list stacked title / uploaded / updated on three lines and felt sparse.

### Frontend changes (`frontend/src/app/pages/media-page.component.ts`)
- Rewrote `.media-row` as a single wrapping flex row: `title → Uploaded … → · Updated … (when edited) → [Edit][Delete]`.
- Removed the nested `.entry` column container; every child is now a direct flex child so items sit inline and wrap gracefully.
- Added `button.compact` (min-width 72px, min-height 32px, 13px font) and `.timestamp.muted` (dimmer color for the secondary "Updated" pill).
- Buttons anchored with `margin-left: auto`; on ≤760px they span the row and buttons stretch to equal width.
- Updated timestamps lead with `· ` separator and omit the trailing colon for a tighter read.
- Reduced `.media-list` gap 8 → 6px and `.media-row` padding 12/14 → 8/12px.

### Trade-offs
- Very long titles still overflow-wrap; buttons stay on the right via `margin-left: auto` but will drop to a second line on narrow widths.
- No change to data model, endpoints, or edit/delete behavior — this is styling-only.

## Validation Evidence
- `frontend npm run test:ci`: `runtime-config 7/7` + `28 Angular tests` pass (post-compaction).
- Backend unchanged from Session 4: `38/38` still reflects current state.
- `frontend npm run build`: pass from Session 4; no backend/structural changes since.

## Unresolved Risks
- Layout review only done against the two-row screenshot case; extremely long single-line titles may push button group to the next line which is acceptable but worth eyeballing at real content lengths.
- All Session 2–5 changes remain uncommitted locally alongside unrelated T-003 showcase work owned by main-generator.

## Decision
continue

## Follow-up Actions
- Stage and commit **only** task4 files once user confirms (backend/src/index.js excludes T-003 diff hunks — coordinate with main-generator).
- After commit, Evaluator4 runs A-004 against the compact layout plus edit/update/delete matrix.

---

## Session 6 Addendum (normalization and status correction)

### Documentation normalization
- This addendum supersedes earlier mojibake/encoding artifacts in historical sections (for example garbled arrows/dashes and one garbled Chinese phrase).
- Canonical wording for Session 5 scope directive:
  - "compact horizontal layout" for the media row presentation.

### Risk status correction
- The Session 3 risk "DELETE endpoint does not verify storage path bucket ownership" is now resolved.
- Evaluator remediation added strict delete-path ownership validation:
  - storage delete now requires configured `SUPABASE_URL` + `SUPABASE_STORAGE_BUCKET` prefix match before deletion.

### Decision
continue
