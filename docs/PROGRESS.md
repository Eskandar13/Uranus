# Progress and handoff (read this first when resuming)

_Last updated: 2026-11-15. All planned building and testing is done. Waiting for the user's design feedback (screenshots), then the Netlify deploy._

## Rules for resuming
- **Pause at 80%** of either the 5-hour or the weekly usage limit (check with the `get_usage` tool before and after big steps). Update this file before stopping.
- Code lives in `menu-platform/`. Read `docs/ARCHITECTURE.md` before changing code (Next.js 16.4 with Cache Components; the rules differ from older Next.js, especially rule #13: never read menu data at build time).
- Approved plan: `C:\Users\Uranus\.claude\plans\https-panuzzo-house-phoenimenu-sy-hi-her-lively-wand.md`

## Done
- Public menu with 3 designs (aurora café, noir grill, pop burger): animations, filters, Arabic-aware search, category navigation, item sheet, dark mode, AR/EN, responsive.
- Demo content: 3 fictional restaurants, 137 items, Unsplash photos, demo accounts (`lib/data/seed/users.json`).
- Landing page, data layer (local JSON + Supabase SQL/RLS/storage; migrations 0001–0003), auth (local + Supabase), owner dashboard, agency admin, `netlify.toml`, `docs/DEPLOY.md`.
- Review round: 44 findings; the actionable ones were verified and fixed.
- 2026-11-12:
  - Owner edits show on the first menu visit. Root cause: build-time `'use cache'` entries; menus are no longer prebuilt.
  - Restaurant timezone for "open now".
  - Batched admin list.
- 2026-11-15:
  - Admin duplicate + delete restaurant (type-the-slug confirmation) and currency save verified in the browser.
  - Local mode: a password change now signs out all other sessions (`passwordChangedAt`), verified with a two-session script test.
- Verified in the browser over the sessions: login/logout, dashboard sold-out toggle → menu, sizes editor, contact validation + save, hours/timezone, currency, QR page, category sheet on phone, admin create/suspend/duplicate/delete/edit-menu.
- Checks: tsc clean, eslint clean, `next build` passes (56 pages; menus fill on first visit).
- `.env.local` (git-ignored) has a test `SESSION_SECRET` + `DEMO_MODE=1` for `npm run start`.

## Design feedback log
- 2026-11-15, round 1 (user screenshots):
  - **Fixed** the landing "Login" button (and the hero "See live demos" button): invisible text. Cause: `.lp a { color: inherit }` (specificity 0,1,1) beat `.lp-btn-primary`; changed to `:where(.lp) a`. Verified in dark and light mode.
  - **Fixed** the item details popup on laptop/desktop/tablet: cut off, no photo, sideways scrollbar. Cause: grid `1.05fr 1fr` columns grew to the min-content width of the "similar items" row. Now `minmax(0,…)` columns + `min-w-0` + `overflow-x-hidden` in `components/menu/item-sheet.tsx` (also fixes the shareable item page). Verified at 1400px and 820px (Arabic).
  - The user will send more screenshots later.
- 2026-11-15, round 2: **fixed** the menu footer phone row alignment in Arabic. `dir="ltr"` on the whole `<a>` pushed the phone line to the opposite side; now `dir="ltr"` is only on the number/email `<span>` in `components/menu/menu-extras.tsx` (MenuFooter). Verified in Arabic and English at 1280px and 375px. (The opening hours were fine; the user confirmed.)

## Pre-launch full check (2026-11-15, in progress)
The user asked for a full error check of everything (demos, owner dashboard, admin), then the Netlify deploy. Workflow `menu-platform-full-check` (run wf_21ed0ac5-ad9) is running: runtime crawl of every page as owner and admin, an i18n/RTL audit, a code review, then fixers per area. If it was interrupted, resume it with `Workflow({scriptPath: <session workflows dir>/menu-platform-full-check-wf_21ed0ac5-ad9.js, resumeFromRunId: "wf_21ed0ac5-ad9"})`, or re-run a smaller check. After it: rebuild, smoke test, then deploy (Next steps #2). Note: `gh` is NOT installed; the Netlify CLI works via `npx netlify`.

## Next steps (in order)
1. **Design feedback:** the user will send more screenshots of what to change. Apply the changes, mainly in `components/menu/**` (menu designs), `components/landing/**` and `components/dashboard/**`, then rebuild and check in the browser.
2. **Deploy** (needs the user's free GitHub + Netlify accounts): follow `docs/DEPLOY.md`. First commit the code (git is initialized in `menu-platform/` with no commits yet) and push to a private GitHub repo, then connect Netlify. Set the env vars `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PLATFORM_NAME`, `SESSION_SECRET`, and optionally `NEXT_PUBLIC_AGENCY_WHATSAPP`.
3. Later: create a Supabase project and test the Supabase mode for real (migrations 0001→0003, `scripts/seed-supabase.mjs`).
4. Minor, optional: unknown menu slugs return HTTP 200 with the not-found UI (soft 404, because not-found streams inside Suspense). Manual check: QR card print and PNG/SVG download.

## Notes
- The browser pane must be visible for streamed content to appear: React reveals Suspense content on animation frames, which pause in a hidden pane. Use curl/scripts when the pane is hidden.
- Test helper for sessions: `C:\Users\Uranus\AppData\Local\Temp\claude\...\scratchpad\session-test.mjs` (login / check / update via the no-JS forms). It may be gone after a restart; it's easy to recreate.

## How to run
```bash
cd menu-platform
npm run dev          # or: npm run build && npm run start
```
http://localhost:3000/ar (landing) · /ar/r/demo-cafe · /en/r/demo-bistro · /ar/r/demo-burger · /ar/login (demo accounts listed)
