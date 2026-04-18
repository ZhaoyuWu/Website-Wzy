# Handover History

## 2026-04-19 - Generator4 Role Consistency Remediation (Scoped)
- Type: public handover update (scoped)
- Scope: generator4 `T-004` follow-up audit blocker fix (`profiles` role consistency)
- Source docs:
  - `handover/local/evaluator.md`
  - `handover/public.md`
- Key outcomes:
  - Closed role data-source split between auth enforcement (`profiles.role`) and role mutation (`app_metadata.role`).
  - Updated bootstrap claim and admin role assignment endpoints to upsert role into `profiles`.
  - Updated admin user list role projection to read role from `profiles` for UI and API consistency.
  - Added backend regression tests verifying role updates are reflected in effective permission chain.
  - Validation passed: backend `33/33`, frontend CI tests pass (`28/28`), frontend build pass.
- Decision: continue
- Next owner: release-owner

## 2026-04-18 - Runtime Supabase Fallback Safety Fix (Scoped)
- Type: public handover update (scoped)
- Scope: frontend runtime-config safety remediation after evaluator follow-up
- Source docs:
  - `handover/local/evaluator.md`
  - `handover/public.md`
- Key outcomes:
  - Replaced repository hardcoded runtime Supabase script values with runtime-config writer policy.
  - Added development-only fallback for Supabase runtime config to avoid local `Missing Supabase config` breakage.
  - Enforced production fail-fast when `NANAMI_SUPABASE_URL` / `NANAMI_SUPABASE_ANON_KEY` are missing.
  - Expanded runtime-config tests to cover development fallback and production mandatory-config behavior.
  - Validation passed: frontend runtime-config `7/7`, frontend CI tests pass (`28/28` Angular tests).
- Decision: continue
- Next owner: release-owner

## 2026-04-18 - Generator5 Task5 Audit and Public Handover
- Type: public handover update (scoped)
- Scope: generator5 `T-005` settings/info audit + regression remediation
- Source docs:
  - `handover/local/generator5-task5.md`
  - `handover/local/evaluator.md`
  - `handover/public.md`
- Key outcomes:
  - Completed evaluator audit for generator5 T-005 delivery.
  - Fixed frontend spec regression caused by `inject()` context requirement in `home-page.component.spec.ts`.
  - Removed reintroduced hardcoded Supabase values from frontend local runtime script.
  - Confirmed role-gated `/admin` behavior and full regression suite health.
  - Validation passed: backend `32/32`, frontend runtime-config `5/5`, frontend CI tests pass, frontend build pass.
- Decision: continue
- Next owner: release-owner

## 2026-04-18 - Generator4 Task4 Audit and Public Handover
- Type: public handover update (scoped)
- Scope: generator4 `T-004` privilege management audit
- Source docs:
  - `handover/local/generator4-task4.md`
  - `handover/local/evaluator.md`
  - `handover/public.md`
- Key outcomes:
  - Completed evaluator audit for role enforcement chain.
  - Added backend regression tests proving Viewer is forbidden for admin-restricted endpoints (`403`).
  - Added backend regression test proving Admin is not blocked by role gate on admin settings path.
  - Normalized generator4 local handover file encoding/content for readability and continuity.
  - Validation passed: backend `32/32`, frontend runtime-config `5/5`, frontend CI tests pass.
- Decision: continue
- Next owner: release-owner

## 2026-04-18 - Generator1 Audit Remediation and Public Handover
- Type: public handover update (scoped)
- Scope: generator1 new modifications (`T-001` + role extensions) audit + blocker remediation
- Source docs:
  - `handover/local/generator1-task1.md`
  - `handover/local/generator.md`
  - `handover/local/evaluator.md`
  - `handover/public.md`
- Key outcomes:
  - Restored task/principles contract baseline after unapproved topology rewrite.
  - Removed hardcoded Supabase runtime values from frontend startup command.
  - Added secure first-admin bootstrap flow (`/api/admin/bootstrap/status`, `/api/admin/bootstrap/claim`).
  - Restored admin page scope to avoid regression (role management + existing media/settings paths).
  - Expanded backend auth tests with bootstrap-admin path checks.
  - Validation passed: backend `30/30`, frontend runtime-config `5/5`, frontend CI tests pass, frontend build pass.
- Decision: continue
- Next owner: release-owner

## 2026-04-18 - Task6 Hardening Public Handover (Evaluator Scoped)
- Type: public handover update (scoped)
- Scope: `T-006` runtime-config/deployment hardening audit + remediation
- Source docs:
  - `handover/local/generator.md`
  - `handover/local/evaluator.md`
  - `handover/public.md`
- Key outcomes:
  - Found and fixed runtime-config security/release risks:
    - URL validation enforced (`http/https` only),
    - production build now fails fast when API base env is missing,
    - generated config value now safely serialized.
  - Added dedicated runtime-config logic tests and included them in frontend CI test flow.
  - Verification passed: backend `27/27`, runtime-config tests `5/5`, frontend CI tests pass.
- Decision: continue
- Next owner: release-owner (deploy env verification + final go/no-go)

## 2026-04-18 - Task5 Settings Public Handover (Evaluator Scoped)
- Type: public handover update (scoped)
- Scope: `T-005` info/settings audit + validation hardening
- Source docs:
  - `handover/local/generator.md`
  - `handover/local/evaluator.md`
  - `handover/public.md`
- Key outcomes:
  - Scoped evaluator audit completed for settings APIs and homepage reflection path.
  - Added settings edge-case validation coverage (control chars + boolean type boundary).
  - Added frontend runtime API base resolution tests.
  - Verification passed: backend `27/27`, frontend tests `24/24`, frontend build pass.
- Decision: continue
- Next owner: producer (`T-006`)

## 2026-04-18 - Task6 Hardening and Release Readiness (Producer Scoped)
- Type: public handover update (scoped)
- Scope: `T-006` responsive/performance/deployment hardening (producer implementation)
- Source docs:
  - `handover/local/generator.md`
  - `handover/public.md`
- Key outcomes:
  - Removed frontend localhost API-base hardcoding via runtime-config resolver and bootstrap file.
  - Added responsive fixes for `<=390px` and `>=1280px` across home/showcase/admin.
  - Added render-cost optimization (`content-visibility`) for media-heavy repeated cards.
  - Added `frontend/vercel.json` (SPA route rewrite + no-store policy for runtime config).
  - Updated release/env checklist in `README.md`.
  - Verification passed: backend `27/27`, frontend tests `24/24`, frontend build pass.
- Decision: continue
- Next owner: evaluator (`A-006`)

## 2026-04-18 - Task4 Upload/Edit Public Handover (Scoped)
- Type: public handover update (scoped)
- Scope: `T-004` upload/edit interface delivery + evaluator audit hardening
- Source docs:
  - `handover/local/generator.md`
  - `handover/local/evaluator.md`
  - `handover/public.md`
- Key outcomes:
  - Scoped audit completed for admin upload/edit flows.
  - Hardened backend media validation by rejecting control characters in title/description.
  - Expanded `T-004` backend tests for payload mismatch and oversize rejection edge cases.
  - Verification passed: backend `26/26`, frontend tests `17/17`, frontend build pass.
- Decision: continue
- Next owner: producer (`T-005`)

## 2026-04-18 - Task3 Showcase Public Handover (Scoped)
- Type: public handover update (scoped)
- Scope: `T-003` showcase delivery + evaluator audit hardening
- Source docs:
  - `handover/local/generator.md`
  - `handover/local/evaluator.md`
  - `handover/public.md`
- Key outcomes:
  - Scoped audit completed for `/showcase` public flow.
  - Added bounded Supabase list retrieval (`limit`) for performance control.
  - Added URL protocol allowlist filtering for media safety.
  - Added Showcase-specific tests; frontend verification passed (`17/17`) with production build pass.
- Decision: continue
- Next owner: producer (`T-004`)

## 2026-04-18 - Evaluator Security Remediation and Test Expansion
- Type: public handover update (scoped)
- Scope: `T-001` security hardening + regression/performance verification
- Source docs:
  - `handover/local/generator.md`
  - `handover/local/evaluator.md`
  - `handover/public.md`
- Key outcomes:
  - Removed weak default admin bootstrap dependency from `db:init`.
  - Added login throttling/lockout and CORS allowlist behavior.
  - Expanded tests to logic + functional + performance layers.
  - Validation passed: backend `11/11`, frontend `11/11`.
- Decision: continue
- Next owner: producer
