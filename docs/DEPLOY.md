# Deploying: Netlify demo, then production

## Step 1: the demo link (free, about 15 minutes)
This puts the three demo menus online so you can send a link or print a QR for customers. It needs no database: the demo content is built into the app.

1. **GitHub:** create a free account and a new **private** repository. Upload the `menu-platform` folder (it's already a git repository; from inside it run `git add -A`, `git commit -m "Menu platform"`, then follow GitHub's "push an existing repository" instructions).
2. **Netlify:** create a free account → *Add new project* (older screens say *Add new site*) → *Import an existing project* → pick the GitHub repository. Netlify reads `netlify.toml`, so leave the build settings as they are.
3. **Before you click Deploy**, on that same screen click *Add environment variables* and add:
   | Name | Value |
   |---|---|
   | `SESSION_SECRET` | a long random string (32+ characters). **Without it the demo dashboard login is turned off.** Make one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `NEXT_PUBLIC_PLATFORM_NAME` | your platform's name |

   Then click **Deploy**. The first build takes a few minutes. (Forgot a variable? Add it under *Project configuration → Environment variables*, older screens *Site configuration*, then redeploy as in step 5.)
4. **Your site address.** Netlify gives the site a random address such as `https://merry-otter-123.netlify.app`. The app picks it up automatically (from Netlify's own `URL` variable) for QR codes, share links and the sitemap, so the demo doesn't need `NEXT_PUBLIC_APP_URL`. For a nicer name, change it under *Project configuration → General → Change project name* (older screens: *Site details → Change site name*), then redeploy. You can also set `NEXT_PUBLIC_APP_URL` yourself (e.g. `https://yourname-menu.netlify.app`); it always wins.
5. **Redeploy after every variable or name change:** *Deploys → Trigger deploy → Clear cache and deploy site*. Netlify only applies new environment variables, a new site name or a new domain on the next build, and the site address is written into the build. This is true for every later change too (Supabase keys, your own domain).
6. Your demo links:
   - `https://yourname-menu.netlify.app/ar/r/demo-cafe`
   - `https://yourname-menu.netlify.app/en/r/demo-bistro`
   - `https://yourname-menu.netlify.app/ar/r/demo-burger`

> In this demo mode the dashboard login works, but **changes can't be saved**: Netlify's disk is read-only, and the dashboard says so. Saving needs Supabase (step 2).

## Step 2: real customers (Supabase)
1. Create a Supabase project (free to start, **Pro ~$25/month** once real customers use it: free projects pause after 7 days without activity).
2. Follow `supabase/README.md`: run the migration SQL, then optionally `node scripts/seed-supabase.mjs` to load the demo restaurants and demo accounts.
3. In Supabase → *Authentication → URL configuration*: set the Site URL to your platform URL and add these redirect URLs:
   `https://<your-domain>/ar/auth/callback` and `https://<your-domain>/en/auth/callback`
4. In Supabase → *Authentication → SMTP*: connect a free email service (Resend, Brevo…). Supabase's built-in sender only allows a few emails per hour.
5. Add to Netlify's environment variables, then redeploy (*Deploys → Trigger deploy → Clear cache and deploy site*):
   | Name | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page (anon / public key) |
   | `SUPABASE_SERVICE_ROLE_KEY` | same page (service role, **keep secret**) |
6. Create your own admin account. Sign up the email in Supabase → Authentication → Users (*Add user*), then run in the SQL editor:
   `insert into platform_admins (user_id) select id from auth.users where email = 'you@yourdomain.com';`

## Step 3: your own domain and restaurant subdomains
1. Buy the platform domain (e.g. `ourmenu.com`) and add it to the Netlify site.
2. Set `NEXT_PUBLIC_ROOT_DOMAIN=ourmenu.com` and `NEXT_PUBLIC_APP_URL=https://app.ourmenu.com` (set it yourself here: Netlify's automatic address would be the main domain), then redeploy.
3. For each restaurant, add `<slug>.ourmenu.com` as a domain alias in Netlify (Domain management → Add domain alias). Its menu opens at `https://<slug>.ourmenu.com`.
4. Once you have many restaurants: ask Netlify support to enable **wildcard subdomains** (`*.ourmenu.com`, paid plan + Netlify DNS). New restaurants then work as soon as you create them in the admin.
5. **A restaurant's own domain** (e.g. `menu.restaurant.com`): the restaurant adds a CNAME record pointing to your Netlify site. You add the domain as an alias in Netlify and type it in the restaurant's "Custom domain" field in the admin.

## Making changes after launch

| What changes | Who does it | Re-upload? |
|---|---|---|
| Menu items, prices, photos, sold-out, hours, colours, theme | The restaurant owner, in their dashboard | **No.** It's live within seconds (needs Supabase connected; the free demo link without Supabase can't save dashboard changes) |
| New restaurants, owners, suspend/activate | You, in the agency admin | **No** |
| Environment variables (Supabase keys, site address, platform name) | You, in Netlify → *Project configuration → Environment variables* | **No upload**, but trigger a redeploy (*Deploys → Trigger deploy → Clear cache and deploy site*): changes apply only after the next build |
| Design or code changes (layout, new features, fixes) | The developer (Claude) changes the code in this folder | **No manual upload.** The change is committed and pushed to GitHub, and Netlify rebuilds the live site automatically in about 1–2 minutes |

Netlify also makes a **preview link** for every change before it goes live (if you use branches or pull requests), so you can check a design change first.

## Local development
```bash
npm install
npm run dev          # http://localhost:3000/ar
```
Without Supabase variables the app uses demo data. Dashboard changes are saved in `.data/db.json` (delete that folder to reset the demo). Demo logins are listed on the login page and in `lib/data/seed/users.json`.
