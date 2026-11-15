# Supabase setup

Without Supabase the app runs in **local mode** (JSON store in `.data/db.json`, uploads in
`.data/uploads`). Follow these steps to switch to Supabase (Postgres + Auth + Storage) for
production.

## 1. Create the project

1. Go to <https://supabase.com/dashboard>, click **New project**, pick a region close to your guests,
   and set a database password (keep it somewhere safe).
2. When the project is ready, open **Project Settings > API** and copy:
   - **Project URL**
   - **anon public** key
   - **service_role** key (secret: never expose it to the browser or commit it)

## 2. Set the environment variables

Create `.env.local` in the project root (and the same variables on your host, e.g. Netlify
**Site configuration > Environment variables**):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>   # server-only; admin actions + seed script
NEXT_PUBLIC_APP_URL=https://your-site.example  # used in invite / reset emails and QR codes
```

As soon as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, the app uses
Supabase (see `lib/env.ts`).

## 3. Run the migration

1. Open **SQL Editor > New query** in the Supabase dashboard.
2. Paste the whole content of [`migrations/0001_init.sql`](migrations/0001_init.sql) and click **Run**.
   Then do the same with [`migrations/0002_timezone.sql`](migrations/0002_timezone.sql) (adds each restaurant's time zone). Run migration files in number order; each is safe to re-run.
   Then `migrations/0003_admin_summaries.sql` (fast item counts for the agency admin list).

It creates the tables (`restaurants`, `categories`, `items`, `restaurant_members`,
`platform_admins`, `profiles`), Row-Level Security policies, helper functions, triggers and the
public Storage bucket `menu-images`. It is idempotent: running it again is harmless.

With the Supabase CLI instead: `supabase link --project-ref <ref>` then `supabase db push`.

## 4. Load the demo content

Either run the seed script:

```bash
node scripts/seed-supabase.mjs                 # restaurants, categories, items (no accounts)
node scripts/seed-supabase.mjs --reset         # clean re-seed of the demo restaurants' menus
node scripts/seed-supabase.mjs --demo-users    # also the demo owner accounts + their memberships
node scripts/seed-supabase.mjs --demo-admin    # also the demo platform admin (implies --demo-users)
node scripts/seed-supabase.mjs --demo-users --reset-passwords   # demo passwords back to the seed values
node scripts/seed-supabase.mjs --remove-demo-users              # delete every demo account
```

It reads `lib/data/seed/restaurants/*.json` (and `lib/data/seed/users.json` for the account
options), uses the service-role key from `.env.local`, and is safe to run again (upserts).

> **Demo accounts are for throw-away demo projects only.** Their passwords are committed in
> `lib/data/seed/users.json`, so anyone who has seen the code can sign in with them, and
> `--demo-admin` gives that access to the whole platform. Never use `--demo-users` or
> `--demo-admin` on a production project. A plain run reports demo accounts left in the project
> (for example by an older version of the script that created them by default); delete them with
> `--remove-demo-users`.

Or, if you prefer the SQL editor, generate plain SQL (content only, no users):

```bash
node scripts/generate-seed-sql.mjs        # writes supabase/seed.sql
```

and run `supabase/seed.sql` in the SQL editor after the migration.

## 5. Create your own admin account

The seed creates no accounts by default. Create your real account in
**Authentication > Users > Add user** (or sign up through an invite), then make it a platform admin
in the SQL editor:

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict do nothing;
```

If demo accounts were ever created in this project (`--demo-users`, `--demo-admin`, or an older
version of the seed script), delete them before going live, after your own admin exists:

```bash
node scripts/seed-supabase.mjs --remove-demo-users
```

## 6. Auth settings

In **Authentication > URL Configuration** set **Site URL** to `NEXT_PUBLIC_APP_URL` and add
`<APP_URL>/**` to the redirect URLs so invite and password-reset links come back to the app.

## How access works

| Who | Can do |
|---|---|
| Anyone (anon) | Read active restaurants, their visible categories and the items of visible categories. |
| Restaurant member (owner / staff) | Read everything of their restaurants; create, edit, delete categories and items; edit the restaurant row except `plan`, `is_active`, `slug`, `custom_domain` (blocked by a trigger); upload images under `menu-images/<restaurantId>/...`. |
| Platform admin | Everything: create / delete restaurants, change plan and status, manage members and admins. |
| Service role (server only) | Bypasses RLS. Used by admin server actions and the seed script. |

Images are stored at `menu-images/<restaurantId>/<logo|cover|category|item>/<uuid>.<ext>` and served
from the public bucket URL, which `next.config.ts` already allows for `next/image`.
