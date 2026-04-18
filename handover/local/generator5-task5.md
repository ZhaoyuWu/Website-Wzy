## Role
generator5

## Task
T-005 - Information and Settings Page

## Target File
handover/local/generator5-task5.md

## Context on Arrival

At start of this task, role/auth architecture had already been introduced:
- `admin-page.component.ts` had role-aware sections:
  - Settings (Admin only),
  - Upload/Media (Publisher + Admin),
  - User Management (Admin only),
  - Bootstrap claim block for non-admin when no admin exists.
- `auth.service.ts` already exposed role helpers:
  - `userRole`, `isAdmin`, `isPublisherOrAdmin`.
- Backend had:
  - role-aware middleware (`requireRole`),
  - user role APIs,
  - bootstrap status/claim APIs.

Route protection had not yet been switched to role guard in routing.

## Changes in This Session

### frontend/src/app/app.routes.ts
- Switched `/admin` from `authGuard` to `roleGuard('Admin', 'Publisher')`.
- Result: Viewer users are redirected away from `/admin`.

### backend/test/auth.test.js
- Added role-gate regression coverage:
  - Viewer gets `403` on admin-restricted endpoints.
  - Admin is not blocked by role gate on admin settings path.

## T-005 DoD Status
- Settings UI exists and supports save/load round-trip.
- Homepage reads public settings payload (`/api/settings`) and reflects changes.
- Admin settings endpoints remain protected by role gate.
- Viewer cannot access admin route once role guard is applied.

## Validation Evidence
- `npm test` (backend): `32 passed, 0 failed`.
- `npm run test:runtime-config` (frontend): `5/5 ok`.
- `npm run test:ci` (frontend): `27 passed, 0 failed`.

## Unresolved Risks
- Role propagation is not immediate after `app_metadata.role` update; re-login may be required.
- Bootstrap claim is intentionally open only when no admin exists; this must be documented in deployment runbook.

## Decision
continue

## Follow-up Actions
- Evaluator validates A-005 matrix (Viewer blocked, Publisher partial access, Admin full settings access).
- Next hardening task verifies deployment/runtime safety end-to-end.
