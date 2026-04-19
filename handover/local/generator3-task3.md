# Local Handover — generator3 / task3

## Role
generator3

## Task
task3 — T-003 Showcase → Home Story Timeline (+ likes, text posts, i18n, UI v2 palette)

## Target File
handover/local/generator3-task3.md

## Summary Written

### Feature flow delivered

1. **Showcase page removed**. `/showcase` route, component, and spec deleted; all "Showcase" nav links stripped from home-page.
2. **Story timeline embedded in home** under `<section id="story">` below hero. New standalone component:
   - `frontend/src/app/components/story-timeline.component.ts` (+ spec)
   - Reads merged `media_items` + `story_posts` from `GET /api/story/timeline?page=N`, newest-first, 20 per page, numeric pagination in-section.
   - Vertical timeline with alternating left/right cards on desktop, stacked on mobile, Caveat font for anchor dates.
   - Images: click opens lightbox (ESC / bg click / × button to close).
   - Likes: heart button toggles via `POST/DELETE /api/story/:type/:id/like`, localStorage key `nanami.story.likes` dedups per browser with `{type,id}` entries.
3. **Text story posts**. New `public.story_posts` table + RPCs in `handover/sql/generator3-task3b-story-timeline.sql` (see sibling DDL trace). Admin/publisher CRUD on `/manage-media` ("Story Text Posts" section), unified under `displayDate` ordering when generator4's migration is applied.
4. **Comments table pre-laid** in same migration as `public.story_comments` (`entry_type` in `media|text`, `entry_id`). No API/UI consumer yet — designed so later adding comments is additive.
5. **Likes DDL from earlier session** (`handover/sql/generator3-task3-media-likes.sql`): `media_items.likes_count` column + `increment_media_likes` / `decrement_media_likes` atomic RPCs. Must be executed in Supabase **before** the story_posts migration.
6. **i18n system (EN / DE / ZH)**:
   - `frontend/src/app/core/i18n.service.ts` — signal-based `I18nService` with full dictionary for all three languages, `t(key, params?)` with `{name}` interpolation, auto-detects `navigator.language` on first load, persists choice to `localStorage.nanami.lang`.
   - `frontend/src/app/components/language-picker.component.ts` — custom dropdown (not native `<select>`), pill button with caret, menu with ink border + 4px hard shadow, hover accent-wash, active accent fill + ✓.
   - Picker embedded in home nav (left of Logout), auth pages, admin/media headers.
   - Translated chrome: home nav + hero + profile card, story timeline (eyebrow, state messages, like/unlike aria-labels, pager), login + register forms, media-page CRUD, admin-page panels.
7. **UI v2 palette ("clash" style)** — no gradients anywhere, all colors via tokens:
   - `styles.scss` new tokens: `--color-accent` (amber `#f5b020`), `--color-accent-soft`, `--color-accent-wash`, `--color-accent-contrast` (red `#d13c3c`), `--color-cool` / `-soft` / `-wash` (dusty blue-gray for tertiary clash), `--color-ink` / `-soft` / `-muted`, `--color-paper` / `-raised` / `-sunk`, `--color-app-bg`, `--color-line`.
   - Sticker card style (`2px ink border + 4px hard offset shadow + 18px radius`) applied uniformly: hero, profile-card, timeline cards, media-card, admin-card, auth-card.
   - Nav pills + picker: `34px` height, `1px line` border default, hover = `accent` fill + `ink` border + 1px lift.
   - Buttons tier: primary (accent), secondary (cool-wash → cool on hover), danger (accent-contrast → inverted on hover); all get 3px ink hard shadow + 1px lift on hover.
   - Role/kind badges: admin = accent, publisher = cool-wash, viewer = paper-sunk; image = cool-wash, video = paper-sunk, text = accent-wash.
   - Removed all `radial-gradient` / `linear-gradient` from home, media, admin, login, register, and story-timeline; replaced with flat tokens.
   - **grep `gradient` across `frontend/src` returns 0 CSS gradient usages** (verified 2026-04-19 after patch).
8. **Hero graffiti**:
   - Hero title in Kalam 700 with per-char rotation (±1–4°) and 6-char color cycle (mostly ink, one char per cycle in accent-contrast).
   - Subtitle in Caveat with per-char rotation and occasional ink / accent-contrast pops, hand-drawn SVG wavy underline.
   - 5 corner doodles (sun, paw, grass, heart, scribble) as inline SVG using `stroke="currentColor"` + CSS `color: var(--color-*)` so doodle palette is token-driven.
   - Removed the hero action buttons ("Explore Timeline / Manage Media / Settings") on user request — nav bar already covers them.
9. **Fonts**:
   - Body: `Nunito` (Google Fonts, weights 400/500/600/700/800) with CJK fallback chain `ZCOOL KuaiLe → PingFang SC → Microsoft YaHei → Segoe UI`. Body weight 500, slight letter-spacing.
   - Hero title: Kalam 700 (marker-like).
   - Timeline dates / handwriting accents: Caveat 500/700.
10. **Favicon / brand mark**:
    - `frontend/src/index.html` links `favicon.ico` + `favicon-{32,192,512}.png` + `apple-touch-icon.png`, overwrote `public/favicon.ico` with PNG content since the prior file was Angular's default.
    - Home nav brand shows `<img src="favicon-192.png">` 36×36 + profile-name + translated "Journal" suffix.
    - Page `<title>` changed from default "Frontend" to "Nanami Journal".

### Files changed (this phase)

- Added: `frontend/src/app/components/story-timeline.component.ts`, `.spec.ts`, `frontend/src/app/components/language-picker.component.ts`, `frontend/src/app/core/i18n.service.ts`.
- Deleted: `frontend/src/app/pages/showcase-page.component.ts`, `.spec.ts`.
- Modified: `frontend/src/app/app.routes.ts`, `app.navigation.spec.ts`, `src/index.html`, `src/styles.scss`, all page components (`home-page.ts` + spec, `login-page.ts`, `register-page.ts`, `media-page.ts`, `admin-page.ts`).
- Backend: `backend/src/index.js` — added `/api/story/timeline`, `/api/story/:type/:id/like` (POST + DELETE), `/api/admin/story-posts` CRUD, helpers `listStoryPosts`, `adjustEntryLikes`, `normalizeStoryBody`, `isValidStoryBody`. Also extended `listMediaItems` select columns with `likes_count`. Removed the deprecated `/api/showcase/*` endpoints. (Backend also gained generator4's `displayDate` code in parallel — not generator3's scope.)
- Backend tests: `backend/test/media.test.js` — replaced showcase tests with 5 new tests (timeline merge order, like/unlike RPC routing, rejected entry type, admin story-posts create happy path + validation). Pre-existing generator4 tests for display-date are untouched.
- DDL artifacts (handover/sql/, see sibling DDL traces): `generator3-task3-media-likes.sql`, `generator3-task3b-story-timeline.sql`.
- Public assets: added `favicon-{32,192,512}.png`, `favicon.png`, `apple-touch-icon.png` in `frontend/public/`; overwrote `favicon.ico`.

## Validation Evidence

- `cd frontend && npm run test:ci` → **36 / 36 passed** (8 test files). Confirmed after each major rework (showcase removal, i18n wiring, button + card restyle, navigation spec adjustment).
- `cd backend && npm test` → **43 / 43 passed**.
- `grep "gradient" frontend/src` → 0 CSS gradient usages remain (sole match is the `sun-spin` `@keyframes` rotation, no color gradient).
- `app.navigation.spec.ts` adjusted to target `button.logout` (the language picker pill is now the first `<button>` in admin nav; selector narrowed to avoid false positive).
- Manual smoke (user-reported) after each DDL migration: timeline request returned 200 with `media` and `text` entries mixed in correct order.

## Unresolved Risks

- **Stale `--clr-*` swatches still exist in `styles.scss`** — the file keeps ~80 legacy colour swatches generated by an earlier auto-extract. The v2 pages no longer reference them, but nothing prevents future components from picking them back up. | Low (no runtime effect) | Mitigation: when touching shared styles next, delete unused `--clr-*` entries and keep only `--color-*` semantic tokens.
- **Like dedup is per-browser only** (`nanami.story.likes` localStorage). Different devices or incognito windows can like the same entry repeatedly; backend has no per-identity guard. | Medium (count inflation is possible but bounded by UX friction) | Mitigation: add optional IP-hash throttle in `adjustEntryLikes` or require login if abuse is observed in production.
- **`story_comments` table built but has no API/UI**. Polymorphic `(entry_type, entry_id)` is not FK-enforced. | Low until a comments feature is built | Mitigation: when implementing comments, add a DB-level trigger or backend validator that checks the pair exists in its parent table.
- **Google Fonts runtime dependency**. Nunito / Caveat / Kalam / ZCOOL KuaiLe load from `fonts.googleapis.com`. If the origin is blocked (e.g., PRC network), body falls back to PingFang/YaHei and timeline loses the handwriting feel. | Low/Medium depending on audience | Mitigation: self-host the fonts under `/public/fonts/` and inline `@font-face` in `styles.scss`; or add a `font-display: swap` guarded block locally for Caveat/Kalam.
- **Favicon cached aggressively by Chrome**. Users may still see the old Angular default unless they hard-reload. | Low | Mitigation: documented in earlier chat replies (hard-reload / clear site data); no code change needed.
- **Two DDL migrations must be applied in order**. `generator3-task3-media-likes.sql` first (adds `likes_count` to media_items), then `generator3-task3b-story-timeline.sql` (creates `story_posts`/`story_comments`). If either is missed the `/api/story/timeline` 500s. Generator4's `generator4-task4-display-date.sql` is independent but required for the unified date ordering to work. | Medium (setup-time only) | Mitigation: already documented in `handover/local/generator3-task3-ddl-trace.md` and `generator3-task3b-ddl-trace.md`; deployer has to execute the SQL files in Supabase SQL Editor before the first e2e.

## Decision

continue — generator3's T-003 scope (plus the UI v2 + i18n extension) is implemented, tests green, and risks captured. No blocker on current branch.

## Follow-up Actions

- Evaluator A-003 audit: verify timeline pagination math, like toggle idempotency at API layer, URL normalisation filters unsafe schemes, and no regression in generator4's display-date ordering.
- Deployer: run both SQL migrations in Supabase before next deploy; re-verify `/api/story/timeline` returns 200 with mixed payload.
- Optional cleanup task: prune unused `--clr-*` tokens from `styles.scss` in a dedicated lint-style PR so new components can't silently adopt them.
- Optional: self-host Google Fonts if the deployment target audience is China-bound.
