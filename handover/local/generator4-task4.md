## Role
generator4

## Task
task4 - T-004 User Privilege Management (Admin / Publisher / Viewer)

## Target File
handover/local/generator4-task4.md

## Summary Written

Architecture context: auth service in this phase is Supabase Auth based, and role source-of-truth is `app_metadata.role`.
All T-004 delivery in this iteration is based on that Supabase auth model.

### Backend changes (`backend/`)
- `scripts/init-db.js`
  - Added `role VARCHAR(20) NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Admin','Publisher','Viewer'))` to `users`.
  - Added `ALTER TABLE ... ADD COLUMN IF NOT EXISTS role ...` for migration safety.
  - Bootstrap admin is enforced as `role = 'Admin'`.
- `src/index.js`
  - `createSession(username, role)` now stores role in session map.
  - `requireAuth` upgraded to async with dual path:
    1. local session token (backward compatible),
    2. Supabase JWT fallback via `GET /auth/v1/user` and parse `app_metadata.role`.
  - Added `requireRole(...roles)` middleware.
  - Permissions:
    - `GET/PATCH /api/admin/settings`: Admin only
    - `GET/POST/PATCH /api/admin/media*`: Admin or Publisher
  - Added Admin-only user role management APIs:
    - `GET /api/admin/users`
    - `PATCH /api/admin/users/:id/role`
  - Added `role` in `login` / `register` / `/api/auth/session` responses.
- tests
  - `test/auth.test.js`, `test/media.test.js`, `test/settings.test.js` db stubs updated with explicit roles.

### Frontend changes (`frontend/src/app/`)
- `core/auth.service.ts`
  - Added role fields in session snapshot and role getters:
    - `userRole`, `isAdmin`, `isPublisherOrAdmin`.
  - Role is resolved from Supabase JWT `app_metadata.role`.
- `core/auth.guard.ts`
  - Added `roleGuard(...roles): CanActivateFn`.
- `app.routes.ts`
  - `/admin` protected by role-aware guard in generator4 implementation.
  - `/register` route restored.
- `pages/admin-page.component.ts`
  - Rebuilt for T-004 role management:
    - role badge,
    - Admin-only user list + role assignment control,
    - Publisher placeholder area.
- `app.navigation.spec.ts`
  - Mock auth service updated for role getters.
- `core/auth.service.spec.ts`
  - Supabase config mocking fixed for register failure branch.

## Validation Evidence
- `npm test` (backend): `27 passed, 0 failed` (generator4 delivery stage)
- `npm run test:ci` (frontend): `27 tests passed, 0 failed` (generator4 delivery stage)
- `npm run test:runtime-config` (frontend): `5/5 ok`

## Unresolved Risks
- Role update propagation delay:
  - updating `app_metadata.role` does not force immediate session/token refresh.
  - user may need re-login to observe new role in client.
- Auth fallback performance:
  - Supabase `/auth/v1/user` round-trip can add latency under high traffic.
- Dual role storage divergence:
  - local `users.role` and Supabase `app_metadata.role` can diverge if not coordinated.
  - current authoritative source is Supabase role.

## Decision
continue

## Follow-up Actions
- Evaluator validates A-004 role matrix:
  - Viewer cannot access admin-restricted operations,
  - Publisher has publish path but no admin role assignment controls,
  - Admin can assign roles successfully.
- Next generator task continues to T-005 scope.
