# Menu platform architecture and conventions

Every contributor and every agent reads this first. It is the contract between the parts of the app.

## Product
A multi-restaurant **digital QR menu platform** (one codebase, many restaurant customers), similar in idea to phoenimenu.
- **Public menu** (guests scan a QR): view-only, no cart. Arabic + English with RTL. Beautiful, lively, animated, responsive on every device.
- **Owner dashboard**: the restaurant owner logs in and edits categories, items, photos, prices, sizes, offers, sold-out, theme, contact info, opening hours, currencies; downloads QR codes.
- **Agency admin**: the platform owner creates restaurants, invites owners, suspends or activates, duplicates restaurants, edits any menu.
- **Landing page**: a sales page for the platform, linking to the demo menus.

## Stack (installed versions)
Next.js **16.4** (App Router, Turbopack, **Cache Components on**), React 19.3, TypeScript, Tailwind CSS v4, shadcn/ui (radix-nova style, RTL enabled) in `components/ui`, `motion` (import from `motion/react`), `vaul`, `embla-carousel-react`, `lucide-react`, `@dnd-kit/*`, `browser-image-compression`, `qrcode`, `zod` v4, `sonner`, `next-themes`, `@supabase/ssr` + `@supabase/supabase-js`.

## Next.js 16.4 rules (this is NOT the Next.js in your training data)
When unsure, read the bundled docs in `node_modules/next/dist/docs/01-app/` (for example `01-getting-started/08-caching.md`, `03-api-reference/01-directives/use-cache.md`, `02-guides/authentication-with-cache-components.md`).
1. **Cache Components is on.** Data fetching is dynamic by default. Use `'use cache'` + `cacheTag()` + `cacheLife()` (from `next/cache`) for data you want cached (the public menu).
2. Reading `cookies()`, `headers()`, `searchParams`, `connection()` or **uncached** async data outside a `<Suspense>` boundary is a **build error**. Push such reads down into a component wrapped in `<Suspense fallback={...}>`. Do not `await` them at the top of a layout.
3. Dynamic `params` not listed by `generateStaticParams` count as runtime data. Either list them in `generateStaticParams` or read them inside `<Suspense>`. `/[lang]` is listed (ar, en) by the root layout.
4. **Removed or unsupported route config with Cache Components:** `export const dynamic`, `revalidate`, `fetchCache`, `runtime`, `dynamicParams`, `experimental_ppr`. Never use them.
5. `'use cache'` functions **cannot** read cookies or headers (directly or deep in the call stack). Read them outside and pass plain values as arguments. Arguments become the cache key (no secrets in arguments).
6. `Date.now()`, `new Date()` and `Math.random()` during server render must be inside `'use cache'` or after `await connection()` inside Suspense. Prefer computing time-dependent UI (such as "open now") in a Client Component after mount.
7. Mutations use **Server Actions** (`'use server'`). Every action re-checks authorization itself, validates input with zod, then calls `updateTag(tag)` (from `next/cache`, only callable in Server Actions) for each tag in `menuTagsFor(restaurant)` from `lib/cache-tags.ts`. Use `revalidateTag(tag, 'max')` in Route Handlers.
8. Dashboard and admin layouts export `export const instant = false;` (they block on the session; that's fine). Their pages read the session inside `<Suspense>`.
9. Middleware is now **`proxy.ts`** (already written; see "Routing").
10. Typed route props: `PageProps<'/[lang]/r/[slug]'>` and `LayoutProps<'/[lang]'>` are global helpers (no import). `params` is a Promise. Run `npx next typegen` after adding routes so these types exist.
11. With Cache Components, navigations keep the previous route mounted but hidden (React `<Activity>`). Effects clean up when hidden. Don't rely on unmount for closing dialogs: close on navigation explicitly.
12. `next/image`: allowed remote hosts are `images.unsplash.com` and Supabase Storage. Allowed local paths: `/uploads/**`, `/demo/**`, `/brand/**`. Always pass `sizes`. Use `placeholder="blur"` + `blurDataURL` when a blur data URL exists.
13. **Never read public menu data at build time** (no `getPublicMenu` in `generateStaticParams` or in prerendered output). `'use cache'` entries created during the build are served stale once after the first `updateTag` following a deploy. Menu routes return only a placeholder from `generateStaticParams` and fill on first visit (verified 2026-11-12: the first request after an edit is fresh, and repeat visits are ~20 ms).

## Data modes
`lib/env.ts` → `getDataMode()`:
- **local** (no Supabase env vars): JSON store at `.data/db.json`, created from the seed (`lib/data/seed`) on first write. Uploads are saved to `.data/uploads/...` and served at `/uploads/...` by `app/uploads/[...path]/route.ts`. Demo login accounts come from the seed. On read-only hosts (Netlify) writes throw `RepositoryError('read_only')` and the dashboard shows a friendly "connect Supabase to save" message; the public menu still works from the seed.
- **supabase**: Postgres + Auth + Storage, with RLS. SQL in `supabase/migrations/`.

**Contract:** `lib/data/types.ts` (domain types, camelCase) and `lib/data/repository.ts` (`MenuRepository`, `RepositoryError`, `RepositoryScope`). Get an instance with `await getRepository(scope)` from `@/lib/data`. Scopes: `"public"` (no cookies, use inside `'use cache'`), `"session"` (dashboard and actions, RLS), `"service"` (admin actions only, after `requirePlatformAdmin`).

**Public cached reads** (menu UI uses only these): `lib/menu/queries.ts` → `getPublicMenu(slugOrDomain)` and `getPublicSlugs()`. A key containing a dot is a custom domain; otherwise it's a slug.

## Auth
`@/lib/auth` (see the doc comments in `lib/auth/index.ts`): `getCurrentUser`, `requireUser(lang)`, `requirePlatformAdmin(lang)`, `requireRestaurantAccess(lang, restaurantId)`, `getActiveRestaurantId(user)`, `setActiveRestaurantId(id)`, `signIn`, `signOut`, `sendPasswordReset`, `inviteOwner`. Local mode uses seed accounts and an HMAC-signed `session` cookie (secret `SESSION_SECRET`, dev fallback). Supabase mode uses Supabase Auth cookies (refreshed in `proxy.ts`).

## Routing (proxy.ts, done)
- Every page is under `/ar/...` or `/en/...` (redirect adds it).
- Platform host (localhost, *.netlify.app, ROOT_DOMAIN, app.ROOT_DOMAIN): `/[lang]` landing, `/[lang]/r/[slug]` menu, `/[lang]/r/[slug]/item/[item]` shareable item page, `/[lang]/login`, `/[lang]/dashboard/...`, `/[lang]/admin/...`.
- `<slug>.ROOT_DOMAIN` or `<slug>.localhost:3000`: `/ar/...` is rewritten to `/ar/r/<slug>/...`. A custom domain is rewritten to `/ar/r/<host>/...`.
- **Menu links must work in both modes.** Inside the menu, never hardcode `/r/<slug>`. Item details open in a sheet driven by the `?item=<slug>` query (client state + `history.replaceState`). Build share links and the language switch from `window.location` on the client (swap the first path segment `/ar` and `/en`).

## i18n
- `lib/i18n/config.ts`: `locales`, `isLocale`, `dirOf`, `pick(localizedText, lang)` (falls back to the other language), `fmt("{n} items", {n})`.
- UI strings: `messages/{ar,en}/{namespace}.json`. Load them on the server with `getDictionary(lang, ns)` from `lib/i18n/dictionaries.ts`. Pass them to Client Components through `<I18nProvider lang messages={{...}}>` (`components/providers/i18n-provider.tsx`) and read them with `useMessages('menu')` and `useI18n()`. **Arabic and English files must have identical keys.** Write natural Arabic, not word-for-word translation.
- Database content is bilingual (`LocalizedText {ar, en}`); show it with `pick(text, lang)`.
- Prices: Latin digits in both languages (`Intl.NumberFormat('ar-u-nu-latn' | 'en')`), currency info from `CURRENCIES` in types.ts (SYP has 0 decimals).

## Styling and RTL
- Tailwind v4 (CSS-first, no tailwind.config). `app/globals.css` holds the shadcn tokens + `no-scrollbar` utility + reduced-motion rule. An area that needs more CSS adds its own file imported by its layout (for example `components/menu/menu.css`).
- **RTL:** use logical utilities only: `ms-* me-* ps-* pe-* start-* end-* text-start text-end border-s border-e rounded-s rounded-e`. Never `ml/mr/pl/pr/left/right` for direction-dependent layout. Directional icons (chevrons, arrows) get `rtl:-scale-x-100`. Carousels and swipe gestures must respect `dir`.
- Fonts: `lib/fonts.ts` exposes CSS variables (`--font-cairo`, `--font-tajawal`, `--font-plex`, `--font-readex`, `--font-messiri`) and `fontVar(id)`. The dashboard uses Plex (the default `font-sans`).
- Dark mode: `next-themes` with `attribute="class"`. Each area has its own `ThemeProvider` with its own `storageKey` (menu: `menu-theme`, defaulting to the restaurant's `theme.mode`; dashboard: `dash-theme`, defaulting to light). Never nest two ThemeProviders.
- Motion: `motion/react`. Animate transform and opacity only, 150–400 ms, spring for sheets and pills. Respect `useReducedMotion()`. No layout thrash and no animation that blocks reading.
- Tap targets ≥ 44 px. Use `env(safe-area-inset-*)` for fixed bars.

## Cache tags
`lib/cache-tags.ts`: `menuTag(slug)`, `restaurantTag(id)`, `domainTag(domain)`, `domainTagsFor(domain)`, `RESTAURANT_LIST_TAG`, `menuTagsFor(restaurant)`. Tags are per tenant: a write to one restaurant must never expire another restaurant's menu.
- A cached menu read is tagged with the tag of its own lookup key (`menuTag(slug)` or `domainTag(domain)`), which also covers a cached "not found", plus every tag in `menuTagsFor(restaurant)` when a restaurant was found. `menuTagsFor` returns the slug, id and custom domain tags, the domain together with its www / non-www twin (`domainTagsFor`), because domain lookups fall back to the twin.
- Every write that changes what guests see calls `updateTag` for each tag in `menuTagsFor(restaurant)`. If a slug or custom domain changes, also update the old version's tags (pass both versions).
- `RESTAURANT_LIST_TAG` is only on the list of public slugs (`getPublicSlugs`) and is NOT part of `menuTagsFor`. Update it explicitly only when the set of active restaurants or their slugs changes (create, delete, duplicate, slug change, active flag). Changes that guests never see (members, owner invites) update no public tag.

## File ownership (parallel build: edit ONLY your files)
| Owner | Files |
|---|---|
| core (done) | `proxy.ts`, `next.config.ts`, `app/[lang]/layout.tsx`, `app/globals.css`, `lib/env.ts`, `lib/cache-tags.ts`, `lib/i18n/*`, `lib/data/types.ts`, `lib/data/repository.ts`, `lib/data/seed/types.ts`, `lib/supabase/*`, `components/providers/i18n-provider.tsx`, `components/ui/*` (shadcn), `messages/*/common.json`, `docs/ARCHITECTURE.md` |
| data-layer | `lib/data/index.ts`, `lib/data/local/**`, `lib/data/supabase/**`, `lib/menu/queries.ts`, `app/uploads/[...path]/route.ts`, `supabase/**`, `scripts/**` |
| seed-content | `lib/data/seed/index.ts`, `lib/data/seed/restaurants/*.json`, `lib/data/seed/users.json` |
| auth-admin | `lib/auth/**`, `app/[lang]/login/**`, `app/[lang]/auth/**`, `app/[lang]/admin/**`, `components/admin/**`, `components/auth/**`, `messages/*/auth.json`, `messages/*/admin.json` |
| dashboard | `app/[lang]/dashboard/**`, `components/dashboard/**`, `lib/dashboard/**`, `lib/images/**` (client-side compression and blur helpers), `messages/*/dashboard.json` |
| menu-ui | `app/[lang]/r/**`, `components/menu/**`, `lib/menu/*` except `queries.ts`, `lib/search/**`, `lib/format/**`, `lib/fonts.ts`, `messages/*/menu.json` |
| landing | `app/[lang]/page.tsx`, `app/[lang]/not-found.tsx`, `components/landing/**`, `public/brand/**`, `messages/*/landing.json`, `app/icon.tsx`, `app/robots.ts`, `app/sitemap.ts` |

Shared helpers other areas may import: `lib/format/price.ts` (menu-ui owns it; `formatPrice(amount, currencyCode, lang)`), `lib/images/*` (dashboard owns it), `components/ui/*`.

## Working rules for builders
- Do **not** run `next build` or `next dev` (other builders share this folder and `.next`). Check your work with `npx next typegen && npx tsc --noEmit -p .` and `npx eslint <your files>`. Ignore errors in files you don't own. If you truly need a dev server, use `NEXT_DIST_DIR=.next-<you> npx next dev -p <unique port>` and stop it when done.
- If you need a change in a file you don't own, don't edit it. Describe the change in your final report.
- Keep secrets server-side. Never import `lib/supabase/clients.ts`, `lib/data/*` or `lib/auth/*` from a Client Component (they're `server-only`).
- Accessibility: semantic HTML, labels, focus rings, `aria-*` on custom controls, visible keyboard focus, good contrast in both themes.
