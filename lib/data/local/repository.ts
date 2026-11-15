import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { RepositoryError, type MenuRepository } from "../repository";
import { isUsableRestaurantSlug, isValidItemSlug, slugify, uniqueItemSlug } from "../slug";
import type {
  Category,
  CategoryPatch,
  ImageFolder,
  ItemOption,
  ItemPatch,
  MemberInfo,
  MemberRole,
  MenuItem,
  NewCategoryInput,
  NewItemInput,
  NewRestaurantInput,
  PublicMenu,
  Restaurant,
  RestaurantPatch,
} from "../types";
import { categoryDefaults, itemDefaults, normalizeDomain, restaurantDefaults } from "./defaults";
import { IMAGE_EXTENSIONS, UPLOADS_DIR, UPLOADS_URL_PREFIX, resolveUploadPath, resolveUploadUrl } from "./paths";
import { assertWritable, readDb, toRepositoryError, updateDb, type LocalDb } from "./store";

/**
 * MenuRepository backed by the local JSON store (.data/db.json). Used when Supabase env vars are
 * missing. Authorization is the caller's job (lib/auth); this layer only validates data.
 */

const IMAGE_FOLDERS: ImageFolder[] = ["logo", "cover", "category", "item"];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const clone = <T>(v: T): T => structuredClone(v);
const nowIso = () => new Date().toISOString();
const bySort = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;
const shortId = (id: string) => id.replace(/-/g, "").slice(0, 8);

function cleanSlug(slug: string): string {
  return (slug ?? "").trim().toLowerCase();
}

function findRestaurant(db: LocalDb, id: string): Restaurant {
  const r = db.restaurants.find((x) => x.id === id);
  if (!r) throw new RepositoryError("not_found", "Restaurant not found");
  return r;
}

function findCategory(db: LocalDb, id: string): Category {
  const c = db.categories.find((x) => x.id === id);
  if (!c) throw new RepositoryError("not_found", "Category not found");
  return c;
}

function findItem(db: LocalDb, id: string): MenuItem {
  const i = db.items.find((x) => x.id === id);
  if (!i) throw new RepositoryError("not_found", "Item not found");
  return i;
}

function assertSlugFree(db: LocalDb, slug: string, exceptId?: string) {
  if (!isUsableRestaurantSlug(slug)) throw new RepositoryError("invalid", "Invalid or reserved slug");
  if (db.restaurants.some((r) => r.slug === slug && r.id !== exceptId)) throw new RepositoryError("slug_taken");
}

function assertDomainFree(db: LocalDb, domain: string | null, exceptId?: string) {
  if (!domain) return;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) throw new RepositoryError("invalid", "Invalid custom domain");
  if (db.restaurants.some((r) => r.customDomain === domain && r.id !== exceptId)) {
    throw new RepositoryError("domain_taken");
  }
}

function withOptionIds(options: ItemOption[] | undefined, fresh = false): ItemOption[] {
  return (options ?? []).map((o) => ({ ...o, id: fresh || !o.id ? randomUUID() : o.id }));
}

function itemSlugsOf(db: LocalDb, restaurantId: string, exceptItemId?: string): Set<string> {
  return new Set(db.items.filter((i) => i.restaurantId === restaurantId && i.id !== exceptItemId).map((i) => i.slug));
}

/** Explicit slug if valid and free; otherwise derived from the name. */
function pickItemSlug(db: LocalDb, restaurantId: string, id: string, name: MenuItem["name"], wanted?: string, exceptItemId?: string) {
  const taken = itemSlugsOf(db, restaurantId, exceptItemId);
  const explicit = wanted ? slugify(wanted, 60) : "";
  if (explicit && isValidItemSlug(explicit) && !taken.has(explicit)) return explicit;
  return uniqueItemSlug(name, taken, shortId(id));
}

/** Rewrites sortOrder: ids in `orderedIds` first (in that order), then the rest in their old order. */
function applyOrder<T extends { id: string; sortOrder: number }>(rows: T[], orderedIds: string[]) {
  const position = new Map<string, number>();
  orderedIds.forEach((id, idx) => {
    if (!position.has(id)) position.set(id, idx);
  });
  const sorted = [...rows].sort((a, b) => {
    const pa = position.get(a.id);
    const pb = position.get(b.id);
    if (pa !== undefined && pb !== undefined) return pa - pb;
    if (pa !== undefined) return -1;
    if (pb !== undefined) return 1;
    return a.sortOrder - b.sortOrder;
  });
  sorted.forEach((row, idx) => {
    row.sortOrder = idx;
  });
}

/* ---------------------------------- images ---------------------------------- */

function extensionFor(contentType: string): string | null {
  const ct = (contentType ?? "").split(";")[0].trim().toLowerCase();
  return IMAGE_EXTENSIONS[ct] ?? null;
}

/** Copies a local upload of `sourceId` into `targetId`'s folder; other URLs are returned as-is. */
async function copyUploadForRestaurant(url: string | null, sourceId: string, targetId: string): Promise<string | null> {
  if (!url || !url.startsWith(`${UPLOADS_URL_PREFIX}${sourceId}/`)) return url;
  const from = resolveUploadUrl(url);
  if (!from) return url;
  const rest = url.slice(`${UPLOADS_URL_PREFIX}${sourceId}/`.length).split(/[?#]/)[0];
  const segments = rest.split("/");
  const fileName = segments.pop() ?? "";
  const ext = path.extname(fileName);
  const newName = `${randomUUID()}${ext}`;
  const to = resolveUploadPath([targetId, ...segments, newName]);
  if (!to) return url;
  try {
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(from, to);
    return `${UPLOADS_URL_PREFIX}${[targetId, ...segments, newName].join("/")}`;
  } catch {
    return url; // Missing source file: keep the old URL rather than failing the duplicate.
  }
}

/* -------------------------------- repository -------------------------------- */

export const localRepository: MenuRepository = {
  /* ---------- public reads ---------- */

  async getRestaurantBySlug(slug) {
    const db = await readDb();
    const s = cleanSlug(slug);
    const r = db.restaurants.find((x) => x.slug === s && x.isActive);
    return r ? clone(r) : null;
  },

  async getRestaurantByDomain(domain) {
    const db = await readDb();
    const d = normalizeDomain(domain);
    if (!d) return null;
    const alt = d.startsWith("www.") ? d.slice(4) : `www.${d}`;
    const r =
      db.restaurants.find((x) => x.isActive && x.customDomain === d) ??
      db.restaurants.find((x) => x.isActive && x.customDomain === alt);
    return r ? clone(r) : null;
  },

  async getPublicMenu(slug): Promise<PublicMenu | null> {
    const db = await readDb();
    const s = cleanSlug(slug);
    const restaurant = db.restaurants.find((x) => x.slug === s && x.isActive);
    if (!restaurant) return null;
    const categories = db.categories
      .filter((c) => c.restaurantId === restaurant.id && c.isVisible)
      .sort(bySort)
      .map((c) => ({
        ...c,
        items: db.items.filter((i) => i.restaurantId === restaurant.id && i.categoryId === c.id).sort(bySort),
      }));
    return clone({ restaurant, categories });
  },

  async listActiveRestaurantSlugs() {
    const db = await readDb();
    return db.restaurants.filter((r) => r.isActive).map((r) => r.slug);
  },

  /* ---------- owner / admin reads ---------- */

  async getRestaurantById(id) {
    const db = await readDb();
    const r = db.restaurants.find((x) => x.id === id);
    return r ? clone(r) : null;
  },

  async listRestaurants() {
    const db = await readDb();
    return clone([...db.restaurants].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  async listCategories(restaurantId) {
    const db = await readDb();
    return clone(db.categories.filter((c) => c.restaurantId === restaurantId).sort(bySort));
  },

  async listItems(restaurantId, opts) {
    const db = await readDb();
    const items = db.items.filter(
      (i) => i.restaurantId === restaurantId && (!opts?.categoryId || i.categoryId === opts.categoryId),
    );
    if (opts?.categoryId) return clone(items.sort(bySort));
    // Group by category order, then item order.
    const catOrder = new Map(
      db.categories.filter((c) => c.restaurantId === restaurantId).map((c) => [c.id, c.sortOrder] as const),
    );
    return clone(
      items.sort(
        (a, b) => (catOrder.get(a.categoryId) ?? 0) - (catOrder.get(b.categoryId) ?? 0) || a.sortOrder - b.sortOrder,
      ),
    );
  },

  async getItem(id) {
    const db = await readDb();
    const i = db.items.find((x) => x.id === id);
    return i ? clone(i) : null;
  },

  async getCategory(id) {
    const db = await readDb();
    const c = db.categories.find((x) => x.id === id);
    return c ? clone(c) : null;
  },

  /* ---------- restaurants ---------- */

  async createRestaurant(input: NewRestaurantInput) {
    const result = await updateDb((db) => {
      const slug = cleanSlug(input.slug);
      assertSlugFree(db, slug);
      const customDomain = normalizeDomain(input.customDomain);
      assertDomainFree(db, customDomain);
      const ts = nowIso();
      const defaults = restaurantDefaults();
      const restaurant: Restaurant = {
        ...defaults,
        ...stripUndefined(input),
        theme: { ...defaults.theme, ...(input.theme ?? {}) },
        contact: { ...defaults.contact, ...(input.contact ?? {}) },
        id: randomUUID(),
        slug,
        name: { ...input.name },
        customDomain,
        createdAt: ts,
        updatedAt: ts,
      };
      db.restaurants.push(restaurant);
      return restaurant;
    });
    return clone(result);
  },

  async updateRestaurant(id, patch: RestaurantPatch) {
    const result = await updateDb((db) => {
      const r = findRestaurant(db, id);
      const next: Restaurant = { ...r, ...stripUndefined(patch), id: r.id, createdAt: r.createdAt, updatedAt: nowIso() };
      if (patch.slug !== undefined) {
        next.slug = cleanSlug(patch.slug);
        if (next.slug !== r.slug) assertSlugFree(db, next.slug, id);
      }
      if (patch.customDomain !== undefined) {
        next.customDomain = normalizeDomain(patch.customDomain);
        if (next.customDomain !== r.customDomain) assertDomainFree(db, next.customDomain, id);
      }
      if (patch.theme) next.theme = { ...r.theme, ...patch.theme };
      if (patch.contact) next.contact = { ...r.contact, ...patch.contact };
      Object.assign(r, next);
      return r;
    });
    return clone(result);
  },

  async deleteRestaurant(id) {
    await updateDb((db) => {
      findRestaurant(db, id);
      db.restaurants = db.restaurants.filter((r) => r.id !== id);
      db.categories = db.categories.filter((c) => c.restaurantId !== id);
      db.items = db.items.filter((i) => i.restaurantId !== id);
      db.memberships = db.memberships.filter((m) => m.restaurantId !== id);
    });
    const dir = resolveUploadPath([id]);
    if (dir) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  },

  async duplicateRestaurant(sourceId, input) {
    assertWritable();
    const snapshot = await readDb();
    const source = snapshot.restaurants.find((r) => r.id === sourceId);
    if (!source) throw new RepositoryError("not_found", "Restaurant not found");
    const slug = cleanSlug(input.slug);
    assertSlugFree(snapshot, slug);

    const newId = randomUUID();
    // Copy local image files first so the copy never shares files with the source
    // (deleting an image in one restaurant must not break the other).
    const srcCats = snapshot.categories.filter((c) => c.restaurantId === sourceId);
    const srcItems = snapshot.items.filter((i) => i.restaurantId === sourceId);
    const copy = (u: string | null) => copyUploadForRestaurant(u, sourceId, newId);
    const [logoUrl, coverUrl] = await Promise.all([copy(source.logoUrl), copy(source.coverUrl)]);
    const catImages = await Promise.all(srcCats.map((c) => copy(c.imageUrl)));
    const itemImages = await Promise.all(srcItems.map((i) => copy(i.imageUrl)));

    const result = await updateDb((db) => {
      assertSlugFree(db, slug);
      const ts = nowIso();
      const restaurant: Restaurant = {
        ...clone(source),
        id: newId,
        slug,
        name: { ...input.name },
        customDomain: null,
        logoUrl,
        coverUrl,
        createdAt: ts,
        updatedAt: ts,
      };
      const catIdMap = new Map<string, string>();
      const categories: Category[] = srcCats.map((c, idx) => {
        const id = randomUUID();
        catIdMap.set(c.id, id);
        return { ...clone(c), id, restaurantId: newId, imageUrl: catImages[idx] };
      });
      const items: MenuItem[] = srcItems
        .map((i, idx) => ({ i, imageUrl: itemImages[idx] }))
        .filter(({ i }) => catIdMap.has(i.categoryId))
        .map(({ i, imageUrl }) => ({
          ...clone(i),
          id: randomUUID(),
          restaurantId: newId,
          categoryId: catIdMap.get(i.categoryId)!,
          imageUrl,
          options: withOptionIds(i.options, true),
          createdAt: ts,
          updatedAt: ts,
        }));
      db.restaurants.push(restaurant);
      db.categories.push(...categories);
      db.items.push(...items);
      return restaurant;
    });
    return clone(result);
  },

  async isSlugAvailable(slug) {
    const s = cleanSlug(slug);
    if (!isUsableRestaurantSlug(s)) return false;
    const db = await readDb();
    return !db.restaurants.some((r) => r.slug === s);
  },

  /* ---------- categories ---------- */

  async createCategory(restaurantId, input: NewCategoryInput) {
    const result = await updateDb((db) => {
      findRestaurant(db, restaurantId);
      const siblings = db.categories.filter((c) => c.restaurantId === restaurantId);
      const category: Category = {
        ...categoryDefaults(),
        ...stripUndefined(input),
        id: randomUUID(),
        restaurantId,
        name: { ...input.name },
        sortOrder: input.sortOrder ?? (siblings.length ? Math.max(...siblings.map((c) => c.sortOrder)) + 1 : 0),
      };
      db.categories.push(category);
      return category;
    });
    return clone(result);
  },

  async updateCategory(id, patch: CategoryPatch) {
    const result = await updateDb((db) => {
      const c = findCategory(db, id);
      Object.assign(c, stripUndefined(patch), { id: c.id, restaurantId: c.restaurantId });
      return c;
    });
    return clone(result);
  },

  async deleteCategory(id) {
    await updateDb((db) => {
      findCategory(db, id);
      db.categories = db.categories.filter((c) => c.id !== id);
      db.items = db.items.filter((i) => i.categoryId !== id);
    });
  },

  async reorderCategories(restaurantId, orderedIds) {
    await updateDb((db) => {
      applyOrder(
        db.categories.filter((c) => c.restaurantId === restaurantId),
        orderedIds,
      );
    });
  },

  /* ---------- items ---------- */

  async createItem(restaurantId, input: NewItemInput) {
    const result = await updateDb((db) => {
      findRestaurant(db, restaurantId);
      const category = findCategory(db, input.categoryId);
      if (category.restaurantId !== restaurantId) throw new RepositoryError("invalid", "Category belongs to another restaurant");
      const id = randomUUID();
      const siblings = db.items.filter((i) => i.categoryId === category.id);
      const ts = nowIso();
      const item: MenuItem = {
        ...itemDefaults(),
        ...stripUndefined(input),
        id,
        restaurantId,
        categoryId: category.id,
        name: { ...input.name },
        price: input.price,
        slug: pickItemSlug(db, restaurantId, id, input.name, input.slug),
        options: withOptionIds(input.options),
        sortOrder: input.sortOrder ?? (siblings.length ? Math.max(...siblings.map((i) => i.sortOrder)) + 1 : 0),
        createdAt: ts,
        updatedAt: ts,
      };
      db.items.push(item);
      return item;
    });
    return clone(result);
  },

  async updateItem(id, patch: ItemPatch) {
    const result = await updateDb((db) => {
      const item = findItem(db, id);
      const next: MenuItem = {
        ...item,
        ...stripUndefined(patch),
        id: item.id,
        restaurantId: item.restaurantId,
        createdAt: item.createdAt,
        updatedAt: nowIso(),
      };
      if (patch.categoryId !== undefined && patch.categoryId !== item.categoryId) {
        const cat = findCategory(db, patch.categoryId);
        if (cat.restaurantId !== item.restaurantId) throw new RepositoryError("invalid", "Category belongs to another restaurant");
        if (patch.sortOrder === undefined) {
          const siblings = db.items.filter((i) => i.categoryId === cat.id);
          next.sortOrder = siblings.length ? Math.max(...siblings.map((i) => i.sortOrder)) + 1 : 0;
        }
      }
      if (patch.slug !== undefined && patch.slug !== item.slug) {
        const wanted = slugify(patch.slug, 60);
        if (!wanted || !isValidItemSlug(wanted)) throw new RepositoryError("invalid", "Invalid item slug");
        if (itemSlugsOf(db, item.restaurantId, item.id).has(wanted)) throw new RepositoryError("slug_taken");
        next.slug = wanted;
      }
      if (patch.options !== undefined) next.options = withOptionIds(patch.options);
      Object.assign(item, next);
      return item;
    });
    return clone(result);
  },

  async deleteItem(id) {
    await updateDb((db) => {
      findItem(db, id);
      db.items = db.items.filter((i) => i.id !== id);
    });
  },

  async duplicateItem(id) {
    const result = await updateDb((db) => {
      const source = findItem(db, id);
      const newId = randomUUID();
      const ts = nowIso();
      // Put the copy right after the original.
      for (const i of db.items) {
        if (i.categoryId === source.categoryId && i.sortOrder > source.sortOrder) i.sortOrder += 1;
      }
      const copy: MenuItem = {
        ...clone(source),
        id: newId,
        slug: uniqueItemSlug({ en: `${source.slug}-copy` }, itemSlugsOf(db, source.restaurantId), shortId(newId)),
        options: withOptionIds(source.options, true),
        sortOrder: source.sortOrder + 1,
        createdAt: ts,
        updatedAt: ts,
      };
      db.items.push(copy);
      return copy;
    });
    return clone(result);
  },

  async reorderItems(categoryId, orderedIds) {
    await updateDb((db) => {
      applyOrder(
        db.items.filter((i) => i.categoryId === categoryId),
        orderedIds,
      );
    });
  },

  /* ---------- images ---------- */

  async uploadImage(restaurantId, folder, file, contentType) {
    assertWritable();
    if (!IMAGE_FOLDERS.includes(folder)) throw new RepositoryError("invalid", "Unknown image folder");
    const ext = extensionFor(contentType || file.type);
    if (!ext) throw new RepositoryError("invalid", "Unsupported image type");
    if (file.size > MAX_UPLOAD_BYTES) throw new RepositoryError("invalid", "Image is too large");
    const fileName = `${randomUUID()}.${ext}`;
    const target = resolveUploadPath([restaurantId, folder, fileName]);
    if (!target) throw new RepositoryError("invalid", "Invalid restaurant id");
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, Buffer.from(await file.arrayBuffer()));
    } catch (err) {
      throw toRepositoryError(err, "storage_failed");
    }
    return { url: `${UPLOADS_URL_PREFIX}${restaurantId}/${folder}/${fileName}` };
  },

  async deleteImage(url) {
    const target = resolveUploadUrl(url);
    if (!target) return; // Not a local upload (demo asset, Unsplash, foreign URL): ignore.
    if (!target.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) return;
    await fs.rm(target, { force: true }).catch(() => {});
  },

  /* ---------- members ---------- */

  async listMembers(restaurantId): Promise<MemberInfo[]> {
    const db = await readDb();
    return db.memberships
      .filter((m) => m.restaurantId === restaurantId)
      .map((m) => ({
        userId: m.userId,
        email: db.users.find((u) => u.id === m.userId)?.email ?? "",
        role: m.role,
      }));
  },

  async listRestaurantSummaries() {
    const db = await readDb();
    const emailOf = new Map(db.users.map((u) => [u.id, u.email] as const));
    const out: Record<string, { itemCount: number; memberEmails: string[] }> = {};
    for (const r of db.restaurants) out[r.id] = { itemCount: 0, memberEmails: [] };
    for (const it of db.items) if (out[it.restaurantId]) out[it.restaurantId].itemCount++;
    for (const m of db.memberships) {
      const email = emailOf.get(m.userId);
      if (email && out[m.restaurantId]) out[m.restaurantId].memberEmails.push(email);
    }
    return out;
  },

  async addMember(restaurantId, userId, role: MemberRole) {
    await updateDb((db) => {
      findRestaurant(db, restaurantId);
      if (!db.users.some((u) => u.id === userId)) throw new RepositoryError("not_found", "User not found");
      const existing = db.memberships.find((m) => m.restaurantId === restaurantId && m.userId === userId);
      if (existing) existing.role = role;
      else db.memberships.push({ restaurantId, userId, role });
    });
  },

  async removeMember(restaurantId, userId) {
    await updateDb((db) => {
      db.memberships = db.memberships.filter((m) => !(m.restaurantId === restaurantId && m.userId === userId));
    });
  },
};

/** Drops keys whose value is undefined so spreads don't erase existing values. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
