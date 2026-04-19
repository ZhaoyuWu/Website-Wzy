## Role
generator7

## Task
T-007-2 — Storage quota visibility (parent: T-007)

## Target File
handover/local/generator7-task7-2.md

## Scope Freeze

### In scope
- Persist `file_size` on every new media upload.
- New role-gated endpoint `GET /api/admin/storage/usage` returns aggregated bytes + thresholds + status.
- `/manage-media` shows a usage banner (progress bar + MB-used / MB-limit / percent) that re-fetches after upload or delete.
- Three i18n keys (EN / DE / ZH) for the heading + warn + critical copy.
- DDL `handover/sql/generator7-task7-2-storage-quota.sql` adds `media_items.file_size bigint` nullable.

### Out of scope (deferred)
- Blocking uploads in the backend when soft/hard limit is reached — Supabase itself enforces the real ceiling; banner is an early warning only.
- Retroactively filling `file_size` for historical rows (we would need to probe each Supabase object, not done here).
- Egress/bandwidth tracking (monthly, separate Supabase metric; needs a different API).

## Files Changed
- `backend/src/index.js` — read `STORAGE_SOFT_LIMIT_BYTES` / `STORAGE_HARD_LIMIT_BYTES` env vars (defaults 800 MB / 1024 MB); insert `file_size: fileBuffer.length` on `POST /api/admin/media`; new `GET /api/admin/storage/usage` with `requireAuth + requireRole('Admin','Publisher')`.
- `backend/test/media.test.js` — two new tests: aggregation + threshold status at `warn`; unauthenticated `401`.
- `frontend/src/app/pages/media-page.component.ts` — new `StorageUsage` type, `storage` field, `loadStorageUsage()`, `formatBytes()`, `storageBarPercent` getter; banner rendered above upload form; refreshed in `ngOnInit`, after successful upload, after successful delete.
- `frontend/src/app/core/i18n.service.ts` — added `media.storage.heading / warn / critical` in EN, DE, ZH.
- `handover/sql/generator7-task7-2-storage-quota.sql` — new DDL.
- `handover/tasks/task.md` — `T-007-2` DoD block.
- `README.md` — migrations table gains row 6 for the new DDL.

## Validation Evidence
- `backend npm test`: **51 passed, 0 failed** (49 prior + 2 new storage usage tests).
- `frontend npm run test:ci`: **36 passed, 0 failed** (no frontend tests touched; banner is read-only UI over API).
- `frontend npm run build`: pass. Main bundle 408.10 kB raw / 95.13 kB transfer (well under 1 MB error budget). Pre-existing `story-timeline.component.ts` style budget warning at 7.47 kB (outside this task's scope — generator3 comments UI expansion).

## Unresolved Risks
- `file_size` is `declaredFileSize` from the buffer, not Supabase's final stored size. Supabase may add a few bytes of metadata overhead. Drift is negligible at MB scale but means the banner can be 0.1–1% lower than the real Supabase dashboard reading.
- Historical rows (pre-T-007-2) have `file_size = NULL` and are excluded from the sum. If the project has 200+ pre-migration photos, the banner will under-report until they are deleted-and-reuploaded or manually backfilled.
- In-memory refresh only fires after upload/delete on this client. Another admin session uploading in parallel will not update this tab's banner until manual reload.
- Soft/hard limits are env-configurable but default to Supabase Free (800 MB warn / 1 GB hard). On Supabase Pro, deployer should raise these in `render.yaml` / Render env to match the new quota.
- Banner is not rendered on Viewer sessions because Viewer cannot reach `/manage-media` anyway, and the endpoint is role-gated for that reason.

## Decision
continue

## Follow-up Actions
- Deployer: apply `generator7-task7-2-storage-quota.sql` in Supabase after the existing five migrations; optionally set `STORAGE_SOFT_LIMIT_BYTES` / `STORAGE_HARD_LIMIT_BYTES` on Render if quota changes.
- Evaluator A-007-2: audit role gating, threshold math, refresh-after-action behaviour, and no desktop/mobile regression.
- Optional T-007-3: shrink `story-timeline.component.ts` inline styles or move to external `.scss` to clear the pre-existing budget warning.
