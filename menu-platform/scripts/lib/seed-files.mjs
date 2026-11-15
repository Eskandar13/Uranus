// Shared helpers for scripts/seed-supabase.mjs and scripts/generate-seed-sql.mjs.
// Plain Node ESM, no dependencies besides what the app already installs.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SEED_DIR = path.join(ROOT, "lib", "data", "seed");
export const RESTAURANTS_DIR = path.join(SEED_DIR, "restaurants");
export const USERS_FILE = path.join(SEED_DIR, "users.json");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

/** Loads .env.local then .env (without overriding variables already set). No dotenv needed. */
export function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(ROOT, name);
    if (!existsSync(file)) continue;
    for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let value = m[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      } else {
        value = value.replace(/\s+#.*$/, "");
      }
      if (process.env[m[1]] === undefined || process.env[m[1]] === "") process.env[m[1]] = value;
    }
  }
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`Cannot parse ${path.relative(ROOT, file)}: ${err.message}`);
  }
}

/**
 * Reads lib/data/seed/restaurants/*.json ({ restaurant, categories, items }) and
 * lib/data/seed/users.json. users.json may be either an array of users, or an object
 * { users, memberships, platformAdminIds }. Users may also carry `memberships` /
 * `isPlatformAdmin` themselves.
 */
export function loadSeed() {
  const files = existsSync(RESTAURANTS_DIR)
    ? readdirSync(RESTAURANTS_DIR).filter((f) => f.endsWith(".json")).sort()
    : [];
  const restaurants = [];
  for (const file of files) {
    const data = readJson(path.join(RESTAURANTS_DIR, file));
    if (!data || typeof data !== "object" || !data.restaurant || !isUuid(data.restaurant.id)) {
      console.warn(`  ! skipping ${file}: expected { restaurant: { id: <uuid>, ... }, categories, items }`);
      continue;
    }
    restaurants.push({
      file,
      restaurant: data.restaurant,
      categories: Array.isArray(data.categories) ? data.categories : [],
      items: Array.isArray(data.items) ? data.items : [],
    });
  }

  let users = [];
  let memberships = [];
  let platformAdminIds = [];
  if (existsSync(USERS_FILE)) {
    const data = readJson(USERS_FILE);
    if (Array.isArray(data)) users = data;
    else if (data && typeof data === "object") {
      users = Array.isArray(data.users) ? data.users : [];
      memberships = Array.isArray(data.memberships) ? data.memberships : [];
      platformAdminIds = Array.isArray(data.platformAdminIds)
        ? data.platformAdminIds
        : Array.isArray(data.platformAdmins)
          ? data.platformAdmins
          : Array.isArray(data.admins)
            ? data.admins
            : [];
    }
    for (const u of users) {
      if (Array.isArray(u.memberships)) {
        for (const m of u.memberships) memberships.push({ userId: u.id, restaurantId: m.restaurantId, role: m.role });
      }
      if (u.isPlatformAdmin && !platformAdminIds.includes(u.id)) platformAdminIds.push(u.id);
    }
  }
  // De-duplicate memberships.
  const seen = new Set();
  memberships = memberships.filter((m) => {
    const key = `${m.userId}:${m.restaurantId}`;
    if (!m.userId || !m.restaurantId || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { restaurants, users, memberships, platformAdminIds };
}

/* ---------------------------- camelCase -> snake_case ---------------------------- */

const text = (v) => (typeof v === "string" ? v : "");
const nul = (v) => (v === undefined || v === "" ? null : v);
const numOrNull = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export function slugifyText(input, max = 60) {
  const base = String(input ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length <= max ? base : base.slice(0, max).replace(/-+$/g, "");
}

export function restaurantRow(r) {
  return {
    id: r.id,
    slug: String(r.slug).toLowerCase(),
    custom_domain: r.customDomain ? String(r.customDomain).toLowerCase() : null,
    name_ar: text(r.name?.ar),
    name_en: text(r.name?.en),
    tagline_ar: text(r.tagline?.ar),
    tagline_en: text(r.tagline?.en),
    description_ar: text(r.description?.ar),
    description_en: text(r.description?.en),
    logo_url: nul(r.logoUrl),
    cover_url: nul(r.coverUrl),
    cover_blur: nul(r.coverBlur),
    theme: r.theme ?? {},
    currency: r.currency || "USD",
    secondary_currency: nul(r.secondaryCurrency),
    exchange_rate: numOrNull(r.exchangeRate),
    contact: r.contact ?? {},
    opening_hours: r.openingHours ?? {},
    timezone: r.timezone ?? "Asia/Damascus",
    is_active: r.isActive !== false,
    plan: ["trial", "basic", "pro"].includes(r.plan) ? r.plan : "trial",
    ...(r.createdAt ? { created_at: r.createdAt } : {}),
  };
}

export function categoryRow(c, restaurantId, index) {
  return {
    id: c.id,
    restaurant_id: restaurantId,
    name_ar: text(c.name?.ar),
    name_en: text(c.name?.en),
    description_ar: text(c.description?.ar),
    description_en: text(c.description?.en),
    image_url: nul(c.imageUrl),
    image_blur: nul(c.imageBlur),
    icon: nul(c.icon),
    sort_order: Number.isFinite(c.sortOrder) ? c.sortOrder : index,
    is_visible: c.isVisible !== false,
  };
}

/** Item rows with slugs made valid and unique per restaurant (the DB enforces both). */
export function itemRows(items, restaurantId) {
  const taken = new Set();
  return items.map((i, index) => {
    let slug = slugifyText(i.slug || i.name?.en || "") || `item-${String(i.id).replace(/-/g, "").slice(0, 8)}`;
    if (taken.has(slug)) slug = `${slug.slice(0, 50)}-${String(i.id).replace(/-/g, "").slice(0, 8)}`;
    taken.add(slug);
    return {
      id: i.id,
      restaurant_id: restaurantId,
      category_id: i.categoryId,
      slug,
      name_ar: text(i.name?.ar),
      name_en: text(i.name?.en),
      description_ar: text(i.description?.ar),
      description_en: text(i.description?.en),
      price: numOrNull(i.price) ?? 0,
      old_price: numOrNull(i.oldPrice),
      image_url: nul(i.imageUrl),
      image_blur: nul(i.imageBlur),
      options: Array.isArray(i.options) ? i.options : [],
      tags: Array.isArray(i.tags) ? i.tags : [],
      calories: numOrNull(i.calories),
      is_available: i.isAvailable !== false,
      is_featured: i.isFeatured === true,
      sort_order: Number.isFinite(i.sortOrder) ? i.sortOrder : index,
      ...(i.createdAt ? { created_at: i.createdAt } : {}),
    };
  });
}

/**
 * Drops what the database would reject and reports it: a bad restaurant slug is fatal (skip the
 * restaurant); categories with non-uuid ids and items with bad ids / unknown categories are dropped.
 */
export function cleanEntry(entry) {
  const warnings = [];
  const r = entry.restaurant;
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(String(r.slug).toLowerCase())) {
    return { fatal: `invalid slug "${r.slug}" (3-40 chars, a-z 0-9 -)`, warnings, categories: [], items: [] };
  }
  const categories = entry.categories.filter((c) => {
    if (isUuid(c.id)) return true;
    warnings.push(`category id "${c.id}" is not a uuid (skipped)`);
    return false;
  });
  const catIds = new Set(categories.map((c) => c.id));
  const items = entry.items.filter((i) => {
    if (!isUuid(i.id)) warnings.push(`item id "${i.id}" is not a uuid (skipped)`);
    else if (!catIds.has(i.categoryId)) warnings.push(`item "${i.slug ?? i.id}" has unknown category (skipped)`);
    else return true;
    return false;
  });
  return { fatal: null, warnings, categories, items };
}
