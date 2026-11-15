# Menu platform (multi-restaurant QR menus)

One codebase that serves a digital menu for every restaurant customer. Each restaurant gets its own link (`/ar/r/<slug>` now, `<slug>.yourdomain.com` later), and owners will edit their menu from a dashboard.

## Run it on your computer
```bash
cd menu-platform
npm install
npm run dev
```
Open:
- http://localhost:3000/ar — platform landing page
- http://localhost:3000/ar/r/demo-cafe — café demo (light "aurora" design)
- http://localhost:3000/en/r/demo-bistro — grill demo (dark "noir" design)
- http://localhost:3000/ar/r/demo-burger — burger demo ("pop" design)
- http://demo-cafe.localhost:3000/ar — the same menu on its own subdomain (how real customers will look)

No accounts or keys are needed: without Supabase settings the app runs on the built-in demo data (`lib/data/seed`).

## Status
| Part | State |
|---|---|
| Public menu (3 designs, animations, filters, search, AR/EN, dark mode, responsive) | Built |
| Demo content (3 fictional restaurants, 137 items, photos) | Built |
| Landing page | Built (set the real WhatsApp number in `components/landing/landing-page.tsx`) |
| Data layer: local demo store + Supabase (tables, security rules, image storage) | Built. The Supabase part hasn't been tried on a real project yet |
| Owner dashboard (menu editing, photos, theme, hours, currency, QR codes) | Built |
| Login, password reset, agency admin (create/suspend/duplicate restaurants, invite owners) | Built |
| Netlify deployment config + guide | Built: see `docs/DEPLOY.md` |

## Where things are
- `docs/ARCHITECTURE.md`: how everything fits together (read this first)
- `app/[lang]/r/[slug]`: public menu pages; `components/menu`: menu UI
- `lib/data`: data model and storage (local + Supabase); `supabase/`: database setup and its README
- `proxy.ts`: works out which restaurant to show from the address

## Dashboard and admin
- http://localhost:3000/ar/login. In demo mode the login page lists the demo accounts with one-click fill (they're also in `lib/data/seed/users.json`).
- Owners land on `/ar/dashboard`, the agency admin on `/ar/admin`.
- Changes are saved to `.data/db.json`. Delete the `.data` folder to reset the demo.

## Known issues / next steps
- The Supabase mode (database, logins, invites, image storage) is written and type-checked but **not yet tested against a real Supabase project**.
- Not yet checked by hand: printing the QR table card and actually downloading the PNG/SVG (the buttons are there and the QR renders).
- Unknown menu addresses show a proper "not found" page but return HTTP 200 instead of 404 (minor, for search engines).
- Supabase: run the migrations `0001`, `0002` and `0003` in order (see `supabase/README.md`).

## Deploying
See `docs/DEPLOY.md` (Netlify demo → Supabase → own domain and subdomains).
