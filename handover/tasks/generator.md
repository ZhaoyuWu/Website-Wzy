# Generator Branch Task (Producer)

## Role
Producer (implementation owner)

## Branch Objective
Implement `T-001` to `T-007` for Nanami showcase according to GStack master task in strict sequence.

## Priority Queue
1. `T-001` Login window (Supabase Auth + route protection).
2. `T-002` Homepage (public landing and narrative structure).
3. `T-003` Showcase page (public image/video feed from Supabase data).
4. `T-004` Upload and edit interface (Supabase Storage + metadata CRUD).
5. `T-005` Info and settings page (Supabase-backed profile/preferences update).
6. `T-006` Hardening + Vercel deployment sweep (validation/responsive/perf/release).
7. `T-007` Mobile layout + visual polish sweep (phone-first UX refinement).
8. `T-007-3` to `T-007-10` Homepage design-motion enhancement pack.

## Scope Freeze (Current Iteration)
- In scope:
  - Admin login for protected management screens (Supabase Auth).
  - Public homepage and showcase pages.
  - Admin upload/edit/info/settings flows.
  - Minimal content metadata fields (`title`, `description`, `type`, `url`, `created_at`).
- Out of scope:
  - Complex multi-role permission model beyond Admin/Publisher/Viewer.
  - External OAuth/social login.
  - Advanced search/recommendation.
- Constraints:
  - Use Supabase Postgres/Auth/Storage as the primary platform.
  - Keep Vercel environment variables and build config documented in handover.

## Ownership Rules
- Producer edits feature implementation files in `/frontend`.
- Producer updates Supabase SQL/schema scripts and integration code when data model changes are needed.
- Producer must add/update test notes for changed behavior.
- Producer must reference task IDs (`T-001` etc.) in commits/handover notes.
- Producer must not overwrite baseline IDs; any scope change must be emitted as child task IDs (`T-xxx-1`, `T-xxx-2`).

## Ready Check
- Parent task loaded from `handover/tasks/task.md`.
- Principles loaded from `standards/principles.md`.
- No unresolved conflict with evaluator branch expectations.
