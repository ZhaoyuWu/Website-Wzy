## Role
producer

## Target File
handover/local/generator.md

## Task
T-004 — User Privilege Management (Admin / Publisher / Viewer)

## Summary Written

### 架构背景
本 session 期间 auth service 被 linter 替换为 Supabase Auth 直连实现（token 来自 Supabase JWT，role 存储在 `app_metadata.role`）。所有 T-004 实现均基于新架构。

### 后端变更

**backend/scripts/init-db.js**
- `users` 表 schema 新增 `role VARCHAR(20) NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Admin','Publisher','Viewer'))`
- 新增 `ALTER TABLE users ADD COLUMN IF NOT EXISTS role ...`（已存在表的迁移安全处理）
- admin bootstrap 用户强制设为 `role = 'Admin'`

**backend/src/index.js**
- `createSession(username, role)` — session Map 中记录 role
- `requireAuth` 升级为 async，支持双路验证：
  1. 自定义 session token（向后兼容，现有测试不变）
  2. Supabase JWT fallback：调用 `GET /auth/v1/user`，从 `app_metadata.role` 读取角色
- `requireRole(...roles)` middleware factory 新增
- 现有端点权限收紧：
  - `GET/PATCH /api/admin/settings` → Admin only
  - `GET/POST/PATCH /api/admin/media*` → Admin | Publisher
- 新增端点（Supabase Admin API 代理）：
  - `GET /api/admin/users` — Admin only，调用 `/auth/v1/admin/users`
  - `PATCH /api/admin/users/:id/role` — Admin only，调用 `/auth/v1/admin/users/:id` (PUT) 更新 `app_metadata.role`
- `login` / `register` 响应新增 `role` 字段
- `/api/auth/session` 响应新增 `role` 字段

**backend/test/auth.test.js / media.test.js / settings.test.js**
- 所有 dbPool stub 用户行补齐 `role: "Admin"` / `role: "Viewer"`，确保 `requireRole` 校验通过

### 前端变更

**frontend/src/app/core/auth.service.ts**
- `SessionSnapshot` 新增 `role: string`
- 新增 getter：`userRole`、`isAdmin`、`isPublisherOrAdmin`
- role 从 Supabase JWT `app_metadata.role` 解析写入 session

**frontend/src/app/core/auth.guard.ts**
- 新增 `roleGuard(...roles): CanActivateFn` — 未登录跳 `/login`，角色不符跳 `/`

**frontend/src/app/app.routes.ts**
- `/admin` 路由改为 `roleGuard('Admin', 'Publisher')` — Viewer 被重定向至首页
- 恢复 `/register` 路由

**frontend/src/app/pages/admin-page.component.ts**
- 完整重写，加入 T-004 用户管理 UI：
  - 顶部显示当前用户 email + role 徽章
  - Admin-only「User Management」区块：列出 Supabase 用户列表，下拉选择器直接改角色，保存反馈（Saving... / ✓ Saved）
  - Publisher-only 占位区块（T-005 上传功能预留）
  - 移动端（≤390px）和桌面端（≥1280px）响应式布局

**frontend/src/app/app.navigation.spec.ts**
- MockAuthService 补齐 `userRole`、`isAdmin`、`isPublisherOrAdmin`

**frontend/src/app/core/auth.service.spec.ts**
- 修复「register 失败」测试：补充 Supabase config mock（原测试缺少 supabaseUrl/supabaseAnonKey 导致在验证前就抛出配置错误）

## Validation Evidence
- `npm test` (backend): `27 passed, 0 failed`
- `npm run test:ci` (frontend): `7 test files, 27 tests passed, 0 failed`
- `npm run test:runtime-config` (frontend): `5/5 ok`

## Unresolved Risks
- **角色延迟生效** | 更新 Supabase `app_metadata.role` 后，当前在线用户 JWT 不立即失效，下次登录/刷新 token 才生效 | 可接受（初期），若需即时生效需引入 token 撤销机制
- **requireAuth Supabase fallback 性能** | 每次请求额外调用一次 Supabase `/auth/v1/user`，高并发下有延迟风险 | 生产部署前可加轻量 LRU 缓存（短 TTL）
- **本地 `users.role` 与 Supabase `app_metadata.role` 潜在不一致** | 两处 role 存储若不同步会产生歧义 | 当前以 Supabase 为权威源；本地列仅作 init-db 兼容保留，后续可清理

## Decision
continue

## Follow-up Actions
- Evaluator 执行 A-004 审计：验证 Viewer 无法进入 `/admin`，Publisher 进入后无 Admin 控件，Admin 可成功修改其他用户角色
- T-005 generator：在首页添加 Publisher/Admin 可见的上传/编辑入口，接通 `POST /api/admin/media` 后端
