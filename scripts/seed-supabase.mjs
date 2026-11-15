#!/usr/bin/env node
// Seeds a Supabase project with the demo restaurants and, only when asked, the demo accounts.
//
//   node scripts/seed-supabase.mjs                     restaurants, categories, items (no accounts)
//   node scripts/seed-supabase.mjs --reset             also delete existing categories/items of the
//                                                      demo restaurants first (clean re-seed)
//   node scripts/seed-supabase.mjs --demo-users        also create the demo OWNER accounts and
//                                                      their memberships
//   node scripts/seed-supabase.mjs --demo-admin        also create the demo platform admin
//                                                      (implies --demo-users)
//   node scripts/seed-supabase.mjs --demo-users --reset-passwords
//                                                      set existing demo users' passwords back to
//                                                      the seed values
//   node scripts/seed-supabase.mjs --remove-demo-users delete every demo account (with it go its
//                                                      memberships and platform-admin rights)
//
// The demo passwords live in lib/data/seed/users.json, i.e. they are public: anyone who has seen
// the code can sign in with them. Demo accounts are therefore opt-in and only belong on a
// throw-away demo project, never on a production one.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from .env.local / .env).
// Idempotent: safe to run again. Run supabase/migrations 0001, 0002 and 0003 first (in order).

import { createClient } from "@supabase/supabase-js";
import { categoryRow, cleanEntry, isUuid, itemRows, loadEnv, loadSeed, restaurantRow } from "./lib/seed-files.mjs";

const log = (msg = "") => console.log(msg);
const ok = (msg) => console.log(`  OK    ${msg}`);
const warn = (msg) => console.log(`  WARN  ${msg}`);
const fail = (msg) => console.log(`  FAIL  ${msg}`);

function exit(msg) {
  console.error(`\n${msg}\n`);
  process.exit(1);
}

// "--no-users" was the opt-out when accounts were seeded by default; it is the default now and
// stays accepted so older instructions keep working.
const KNOWN_FLAGS = ["--reset", "--demo-users", "--demo-admin", "--reset-passwords", "--remove-demo-users", "--no-users"];
const args = new Set(process.argv.slice(2));
const unknownFlags = [...args].filter((a) => !KNOWN_FLAGS.includes(a));
if (unknownFlags.length) {
  exit(`Unknown option(s): ${unknownFlags.join(" ")}\nOptions: ${KNOWN_FLAGS.join(" ")} (see the top of this script).`);
}
const RESET = args.has("--reset");
const DEMO_ADMIN = args.has("--demo-admin");
const DEMO_USERS = DEMO_ADMIN || args.has("--demo-users");
const RESET_PASSWORDS = args.has("--reset-passwords");
const REMOVE_DEMO_USERS = args.has("--remove-demo-users");
if (DEMO_USERS && args.has("--no-users")) exit("--no-users cannot be combined with --demo-users / --demo-admin.");
if (REMOVE_DEMO_USERS && (DEMO_USERS || RESET)) exit("--remove-demo-users runs on its own (no other options).");
if (RESET_PASSWORDS && !DEMO_USERS) exit("--reset-passwords only applies together with --demo-users or --demo-admin.");

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  exit(
    "Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local\n" +
      "(Supabase dashboard > Project Settings > API).",
  );
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const counts = {
  restaurants: 0,
  categories: 0,
  items: 0,
  usersCreated: 0,
  usersExisting: 0,
  usersRemoved: 0,
  memberships: 0,
  admins: 0,
  failures: 0,
};

async function upsertChunks(table, rows, size = 500) {
  for (let k = 0; k < rows.length; k += size) {
    const { error } = await sb.from(table).upsert(rows.slice(k, k + size), { onConflict: "id" });
    if (error) throw error;
  }
}

async function checkSchema() {
  const { error } = await sb.from("restaurants").select("id").limit(1);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) {
      exit(
        "The tables do not exist yet. Run supabase/migrations 0001, 0002 and 0003 (in order) in the Supabase SQL editor first.",
      );
    }
    exit(`Cannot reach Supabase: ${error.message}`);
  }
  // restaurantRow() always writes timezone, which 0002_timezone.sql adds.
  const { error: tzError } = await sb.from("restaurants").select("timezone").limit(1);
  if (tzError) {
    if (tzError.code === "42703" || /timezone/i.test(tzError.message)) {
      exit(
        "The restaurants table has no timezone column. Run supabase/migrations/0002_timezone.sql (and then 0003) " +
          "in the Supabase SQL editor first.",
      );
    }
    exit(`Cannot reach Supabase: ${tzError.message}`);
  }
}

async function seedRestaurants(entries) {
  log(`\nRestaurants (${entries.length})`);
  const seeded = new Set();
  for (const entry of entries) {
    const r = entry.restaurant;
    const label = `${r.slug} (${entry.file})`;
    const cleaned = cleanEntry(entry);
    if (cleaned.fatal) {
      fail(`${label}: ${cleaned.fatal}`);
      counts.failures++;
      continue;
    }
    cleaned.warnings.forEach((w) => warn(`${label}: ${w}`));
    try {
      const { error: rErr } = await sb.from("restaurants").upsert(restaurantRow(r), { onConflict: "id" });
      if (rErr) {
        if (rErr.code === "23505") {
          throw new Error(
            /custom_domain/.test(rErr.message + rErr.details)
              ? `custom domain "${r.customDomain}" is used by another restaurant`
              : `slug "${r.slug}" is used by another restaurant (different id)`,
          );
        }
        throw rErr;
      }
      if (RESET) {
        // Cascades to items.
        const { error } = await sb.from("categories").delete().eq("restaurant_id", r.id);
        if (error) throw error;
      }
      await upsertChunks("categories", cleaned.categories.map((c, idx) => categoryRow(c, r.id, idx)));
      const rows = itemRows(cleaned.items, r.id);
      try {
        await upsertChunks("items", rows);
      } catch (err) {
        if (err.code === "23505") {
          throw new Error(`an item slug clashes with an older item of this restaurant. Re-run with --reset.`);
        }
        throw err;
      }
      counts.restaurants++;
      counts.categories += cleaned.categories.length;
      counts.items += rows.length;
      seeded.add(r.id);
      ok(`${label}: ${cleaned.categories.length} categories, ${rows.length} items`);
    } catch (err) {
      counts.failures++;
      fail(`${label}: ${err.message ?? err}`);
    }
  }
  return seeded;
}

async function listAllUsers() {
  const byEmail = new Map();
  for (let page = 1; page < 100; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (u.email) byEmail.set(u.email.toLowerCase(), u);
    if (data.users.length < 1000) break;
  }
  return byEmail;
}

/** Creates missing demo users; returns a map seedUserId -> real auth user id. */
async function seedUsers(users) {
  log(`\nUsers (${users.length})`);
  const idMap = new Map();
  if (users.length === 0) {
    warn("lib/data/seed/users.json not found or empty: no demo accounts created.");
    return idMap;
  }
  const existing = await listAllUsers();
  for (const u of users) {
    const email = String(u.email ?? "").trim().toLowerCase();
    if (!email || !u.password) {
      warn(`skipping user without email/password (${u.id ?? "?"})`);
      continue;
    }
    const metadata = { display_name: u.displayName ?? null };
    try {
      const found = existing.get(email);
      if (found) {
        idMap.set(u.id, found.id);
        counts.usersExisting++;
        if (RESET_PASSWORDS) {
          const { error } = await sb.auth.admin.updateUserById(found.id, { password: u.password, user_metadata: metadata });
          if (error) throw error;
          ok(`${email}: exists, password reset`);
        } else {
          ok(`${email}: exists${found.id !== u.id ? ` (id ${found.id})` : ""}`);
        }
      } else {
        const attrs = { email, password: u.password, email_confirm: true, user_metadata: metadata };
        let { data, error } = await sb.auth.admin.createUser(isUuid(u.id) ? { ...attrs, id: u.id } : attrs);
        if (error && isUuid(u.id)) ({ data, error } = await sb.auth.admin.createUser(attrs)); // id taken/unsupported
        if (error) throw error;
        idMap.set(u.id, data.user.id);
        counts.usersCreated++;
        ok(`${email}: created`);
      }
      const realId = idMap.get(u.id);
      await sb.from("profiles").upsert({ id: realId, email, display_name: u.displayName ?? null }, { onConflict: "id" });
    } catch (err) {
      counts.failures++;
      fail(`${email}: ${err.message ?? err}`);
    }
  }
  return idMap;
}

async function seedMemberships(memberships, platformAdminIds, idMap, seededRestaurants) {
  log(`\nMemberships and admins`);
  for (const m of memberships) {
    const userId = idMap.get(m.userId);
    if (!userId) {
      warn(`membership skipped: unknown user ${m.userId}`);
      continue;
    }
    if (!seededRestaurants.has(m.restaurantId)) {
      warn(`membership skipped: restaurant ${m.restaurantId} was not seeded`);
      continue;
    }
    const role = m.role === "staff" ? "staff" : "owner";
    const { error } = await sb
      .from("restaurant_members")
      .upsert({ restaurant_id: m.restaurantId, user_id: userId, role }, { onConflict: "restaurant_id,user_id" });
    if (error) {
      counts.failures++;
      fail(`member ${userId} -> ${m.restaurantId}: ${error.message}`);
    } else {
      counts.memberships++;
      ok(`${role} ${userId} -> ${m.restaurantId}`);
    }
  }
  for (const seedId of platformAdminIds) {
    const userId = idMap.get(seedId);
    if (!userId) {
      warn(`platform admin skipped: unknown user ${seedId}`);
      continue;
    }
    const { error } = await sb.from("platform_admins").upsert({ user_id: userId }, { onConflict: "user_id" });
    if (error) {
      counts.failures++;
      fail(`platform admin ${userId}: ${error.message}`);
    } else {
      counts.admins++;
      ok(`platform admin ${userId}`);
    }
  }
}

/** Seed users that exist in this project, as [seed user, auth user] pairs (matched by email). */
async function findDemoAccounts(users) {
  const existing = await listAllUsers();
  const found = [];
  for (const u of users) {
    const account = existing.get(String(u.email ?? "").trim().toLowerCase());
    if (account) found.push([u, account]);
  }
  return found;
}

/** Default run: no accounts are touched, but demo accounts left by an earlier run are reported. */
async function reportDemoAccounts(users) {
  if (users.length === 0) return;
  let found;
  try {
    found = await findDemoAccounts(users);
  } catch (err) {
    warn(`could not check for demo accounts: ${err.message ?? err}`);
    return;
  }
  if (found.length === 0) return;
  log(`\nDemo accounts found in this project`);
  for (const [, account] of found) {
    warn(`${account.email} exists and may still use its public seed password.`);
  }
  warn("Delete them before going live: node scripts/seed-supabase.mjs --remove-demo-users");
}

async function removeDemoAccounts(users) {
  log(`\nRemoving demo accounts (${users.length} in lib/data/seed/users.json)`);
  const found = await findDemoAccounts(users);
  if (found.length === 0) {
    ok("no demo accounts in this project");
    return;
  }
  for (const [, account] of found) {
    // Memberships, platform-admin rows and the profile are deleted by their ON DELETE CASCADE.
    const { error } = await sb.auth.admin.deleteUser(account.id);
    if (error) {
      counts.failures++;
      fail(`${account.email}: ${error.message}`);
    } else {
      counts.usersRemoved++;
      ok(`${account.email}: deleted`);
    }
  }
}

async function main() {
  const host = new URL(url).host;
  await checkSchema();
  const seed = loadSeed();

  if (REMOVE_DEMO_USERS) {
    // Account clean-up only: no content is written.
    log(`Cleaning up ${host}`);
    await removeDemoAccounts(seed.users);
    log(
      `\nDone: ${counts.usersRemoved} demo account(s) deleted.` +
        (counts.usersRemoved ? " Make sure your own platform admin account exists (supabase/README.md)." : "") +
        (counts.failures ? `\n${counts.failures} problem(s) above.` : ""),
    );
    process.exit(counts.failures ? 1 : 0);
  }

  log(`Seeding ${host}${RESET ? " (reset)" : ""}`);
  if (seed.restaurants.length === 0) {
    warn("No restaurant files found in lib/data/seed/restaurants/*.json");
  }
  const seeded = await seedRestaurants(seed.restaurants);
  if (DEMO_USERS) {
    log(
      `\nWARNING: creating demo accounts whose passwords are published in lib/data/seed/users.json.\n` +
        `Anyone who has seen the code can sign in with them${DEMO_ADMIN ? ", including as platform admin" : ""}.\n` +
        `Only do this on a throw-away demo project; remove them with --remove-demo-users.`,
    );
    // The platform admin account is only created when it is explicitly asked for.
    const adminIds = new Set(DEMO_ADMIN ? [] : seed.platformAdminIds);
    const idMap = await seedUsers(seed.users.filter((u) => !adminIds.has(u.id)));
    await seedMemberships(seed.memberships, DEMO_ADMIN ? seed.platformAdminIds : [], idMap, seeded);
  } else {
    await reportDemoAccounts(seed.users);
  }
  log(
    `\nDone: ${counts.restaurants} restaurants, ${counts.categories} categories, ${counts.items} items` +
      (DEMO_USERS
        ? `, ${counts.usersCreated} users created (${counts.usersExisting} existing), ${counts.memberships} memberships, ` +
          `${counts.admins} platform admins.`
        : ". No accounts created (add --demo-users for the demo owner accounts).") +
      (counts.failures ? `\n${counts.failures} problem(s) above.` : ""),
  );
  process.exit(counts.failures ? 1 : 0);
}

main().catch((err) => exit(`Seed failed: ${err.message ?? err}`));
