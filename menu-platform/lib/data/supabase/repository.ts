import "server-only";
import { randomUUID } from "node:crypto";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { IMAGE_BUCKET } from "@/lib/supabase/clients";
import { RepositoryError, type MenuRepository, type RepositoryErrorCode } from "../repository";
import { isUsableRestaurantSlug, isValidItemSlug, slugify, uniqueItemSlug } from "../slug";
import type {
  Category,
  ImageFolder,
  ItemOption,
  MemberInfo,
  MenuItem,
  PublicMenu,
  Restaurant,
} from "../types";
import { categoryDefaults, itemDefaults, normalizeDomain, restaurantDefaults } from "../local/defaults";
import {
  categoryToRow,
  itemToRow,
  restaurantToRow,
  rowToCategory,
  rowToItem,
  rowToRestaurant,
  type CategoryRow,
  type ItemRow,
  type RestaurantRow,
} from "./mappers";

/**
 * MenuRepository on Supabase (Postgres + Storage). The client decides the permissions:
 * publicClient (anon, RLS public policies), sessionClient (user, RLS) or serviceClient (bypasses RLS).
 */

const IMAGE_FOLDERS: ImageFolder[] = ["logo", "cover", "category", "item"];
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/pjpeg": "jpeg",
  "image/png": "png",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const PUBLIC_PREFIX = `/storage/v1/object/public/${IMAGE_BUCKET}/`;

const shortId = (id: string) => id.replace(/-/g, "").slice(0, 8);
const bySort = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

/** Maps a PostgREST / Postgres error to RepositoryError. */
export function toRepositoryError(error: PostgrestError | { message: string; code?: string } | null): RepositoryError {
  if (!error) return new RepositoryError("unknown");
  const code = (error as PostgrestError).code ?? "";
  const text = `${error.message ?? ""} ${(error as PostgrestError).details ?? ""} ${(error as PostgrestError).hint ?? ""}`;
  let repoCode: RepositoryErrorCode = "unknown";
  if (code === "23505") {
    repoCode = /custom_domain/i.test(text) ? "domain_taken" : /slug/i.test(text) ? "slug_taken" : "invalid";
  } else if (code === "PGRST116") repoCode = "not_found";
  else if (code === "42501" || code === "PGRST301" || code === "PGRST302") repoCode = "forbidden";
  else if (code === "23503" || code === "23514" || code === "22P02" || code === "23502" || code === "22023") repoCode = "invalid";
  return new RepositoryError(repoCode, error.message);
}

/** Throws on error; data must be present (lists, .single()). */
function check<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw toRepositoryError(res.error);
  if (res.data === null || res.data === undefined) throw new RepositoryError("not_found");
  return res.data as NonNullable<T>;
}

/** Throws on error; null data is fine (.maybeSingle()). */
function maybe<T>(res: { data: T; error: PostgrestError | null }): T {
  if (res.error) throw toRepositoryError(res.error);
  return res.data;
}

/** Throws on error; ignores data (insert/update/delete/rpc without select). */
function ok(res: { error: PostgrestError | null }): void {
  if (res.error) throw toRepositoryError(res.error);
}

function withOptionIds(options: ItemOption[] | undefined, fresh = false): ItemOption[] {
  return (options ?? []).map((o) => ({ ...o, id: fresh || !o.id ? randomUUID() : o.id }));
}

/** Storage object path ("<rid>/<folder>/<file>") of a public URL in our bucket, else null. */
function storagePathOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const idx = url.indexOf(PUBLIC_PREFIX);
  if (idx === -1) return null;
  const raw = url.slice(idx + PUBLIC_PREFIX.length).split(/[?#]/)[0];
  try {
    const path = decodeURIComponent(raw);
    return path && !path.includes("..") ? path : null;
  } catch {
    return null;
  }
}

export function createSupabaseRepository(sb: SupabaseClient): MenuRepository {
  const restaurants = () => sb.from("restaurants");
  const categories = () => sb.from("categories");
  const items = () => sb.from("items");

  async function requireRestaurant(id: string): Promise<Restaurant> {
    const row = maybe(await restaurants().select("*").eq("id", id).maybeSingle<RestaurantRow>());
    if (!row) throw new RepositoryError("not_found", "Restaurant not found");
    return rowToRestaurant(row);
  }

  async function requireCategory(id: string): Promise<Category> {
    const row = maybe(await categories().select("*").eq("id", id).maybeSingle<CategoryRow>());
    if (!row) throw new RepositoryError("not_found", "Category not found");
    return rowToCategory(row);
  }

  async function requireItem(id: string): Promise<MenuItem> {
    const row = maybe(await items().select("*").eq("id", id).maybeSingle<ItemRow>());
    if (!row) throw new RepositoryError("not_found", "Item not found");
    return rowToItem(row);
  }

  async function nextSortOrder(table: "categories" | "items", column: "restaurant_id" | "category_id", value: string) {
    const rows = check(
      await sb.from(table).select("sort_order").eq(column, value).order("sort_order", { ascending: false }).limit(1),
    ) as Array<{ sort_order: number }>;
    return rows.length ? rows[0].sort_order + 1 : 0;
  }

  async function itemSlugs(restaurantId: string, exceptItemId?: string): Promise<Set<string>> {
    const rows = check(await items().select("id, slug").eq("restaurant_id", restaurantId)) as Array<{ id: string; slug: string }>;
    return new Set(rows.filter((r) => r.id !== exceptItemId).map((r) => r.slug));
  }

  async function slugAvailable(slug: string): Promise<boolean> {
    if (!isUsableRestaurantSlug(slug)) return false;
    const { data, error } = await sb.rpc("is_slug_available", { candidate: slug });
    if (!error && typeof data === "boolean") return data;
    // Fallback (e.g. anon client without execute grant): what this client can see.
    const rows = check(await restaurants().select("id").eq("slug", slug).limit(1)) as Array<{ id: string }>;
    return rows.length === 0;
  }

  async function assertDomainFormat(domain: string | null) {
    if (domain && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) throw new RepositoryError("invalid", "Invalid custom domain");
  }

  /** Copies an image of `sourceId` in our bucket into `targetId`'s folder; other URLs unchanged. */
  async function copyImage(url: string | null, sourceId: string, targetId: string): Promise<string | null> {
    const from = storagePathOf(url);
    if (!from || !from.startsWith(`${sourceId}/`)) return url;
    const rest = from.slice(sourceId.length + 1).split("/");
    const file = rest.pop() ?? "";
    const ext = file.includes(".") ? file.slice(file.lastIndexOf(".")) : "";
    const to = [targetId, ...rest, `${randomUUID()}${ext}`].join("/");
    const { error } = await sb.storage.from(IMAGE_BUCKET).copy(from, to);
    if (error) return url;
    return sb.storage.from(IMAGE_BUCKET).getPublicUrl(to).data.publicUrl;
  }

  async function removeRestaurantFiles(restaurantId: string) {
    const bucket = sb.storage.from(IMAGE_BUCKET);
    for (const folder of IMAGE_FOLDERS) {
      for (let page = 0; page < 50; page++) {
        const { data, error } = await bucket.list(`${restaurantId}/${folder}`, { limit: 100 });
        if (error || !data || data.length === 0) break;
        const paths = data.filter((f) => f.name && f.id).map((f) => `${restaurantId}/${folder}/${f.name}`);
        if (paths.length === 0) break;
        const { error: rmError } = await bucket.remove(paths);
        if (rmError) break;
      }
    }
  }

  const repo: MenuRepository = {
    /* ---------- public reads ---------- */

    async getRestaurantBySlug(slug) {
      const row = maybe(
        await restaurants().select("*").eq("slug", slug.trim().toLowerCase()).eq("is_active", true).maybeSingle<RestaurantRow>(),
      );
      return row ? rowToRestaurant(row) : null;
    },

    async getRestaurantByDomain(domain) {
      const d = normalizeDomain(domain);
      if (!d) return null;
      const alt = d.startsWith("www.") ? d.slice(4) : `www.${d}`;
      const rows = check(
        await restaurants().select("*").in("custom_domain", [d, alt]).eq("is_active", true).returns<RestaurantRow[]>(),
      );
      const row = rows.find((r) => r.custom_domain === d) ?? rows[0];
      return row ? rowToRestaurant(row) : null;
    },

    async getPublicMenu(slug): Promise<PublicMenu | null> {
      const restaurant = await repo.getRestaurantBySlug(slug);
      if (!restaurant) return null;
      const [catRows, itemRows] = await Promise.all([
        categories()
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .eq("is_visible", true)
          .order("sort_order")
          .returns<CategoryRow[]>(),
        items().select("*").eq("restaurant_id", restaurant.id).order("sort_order").returns<ItemRow[]>(),
      ]);
      const cats = check(catRows).map(rowToCategory);
      const allItems = check(itemRows).map(rowToItem);
      const byCategory = new Map<string, MenuItem[]>();
      for (const item of allItems) {
        const list = byCategory.get(item.categoryId);
        if (list) list.push(item);
        else byCategory.set(item.categoryId, [item]);
      }
      return {
        restaurant,
        categories: cats.sort(bySort).map((c) => ({ ...c, items: (byCategory.get(c.id) ?? []).sort(bySort) })),
      };
    },

    async listActiveRestaurantSlugs() {
      const rows = check(await restaurants().select("slug").eq("is_active", true).order("slug")) as Array<{ slug: string }>;
      return rows.map((r) => r.slug);
    },

    /* ---------- owner / admin reads ---------- */

    async getRestaurantById(id) {
      const row = maybe(await restaurants().select("*").eq("id", id).maybeSingle<RestaurantRow>());
      return row ? rowToRestaurant(row) : null;
    },

    async listRestaurants() {
      const rows = check(await restaurants().select("*").order("created_at", { ascending: false }).returns<RestaurantRow[]>());
      return rows.map(rowToRestaurant);
    },

    async listCategories(restaurantId) {
      const rows = check(
        await categories().select("*").eq("restaurant_id", restaurantId).order("sort_order").returns<CategoryRow[]>(),
      );
      return rows.map(rowToCategory);
    },

    async listItems(restaurantId, opts) {
      let q = items().select("*").eq("restaurant_id", restaurantId);
      if (opts?.categoryId) q = q.eq("category_id", opts.categoryId);
      const rows = check(await q.order("sort_order").returns<ItemRow[]>()).map(rowToItem);
      if (opts?.categoryId) return rows;
      const cats = await repo.listCategories(restaurantId);
      const catOrder = new Map(cats.map((c) => [c.id, c.sortOrder] as const));
      return rows.sort(
        (a, b) => (catOrder.get(a.categoryId) ?? 0) - (catOrder.get(b.categoryId) ?? 0) || a.sortOrder - b.sortOrder,
      );
    },

    async getItem(id) {
      const row = maybe(await items().select("*").eq("id", id).maybeSingle<ItemRow>());
      return row ? rowToItem(row) : null;
    },

    async getCategory(id) {
      const row = maybe(await categories().select("*").eq("id", id).maybeSingle<CategoryRow>());
      return row ? rowToCategory(row) : null;
    },

    /* ---------- restaurants ---------- */

    async createRestaurant(input) {
      const slug = input.slug.trim().toLowerCase();
      if (!isUsableRestaurantSlug(slug)) throw new RepositoryError("invalid", "Invalid or reserved slug");
      const customDomain = normalizeDomain(input.customDomain);
      await assertDomainFormat(customDomain);
      const defaults = restaurantDefaults();
      const full: Omit<Restaurant, "id" | "createdAt" | "updatedAt"> = {
        ...defaults,
        ...stripUndefined(input),
        name: { ...input.name },
        slug,
        customDomain,
        theme: { ...defaults.theme, ...(input.theme ?? {}) },
        contact: { ...defaults.contact, ...(input.contact ?? {}) },
      };
      const row = check(
        await restaurants()
          .insert({ id: randomUUID(), ...restaurantToRow(full) })
          .select("*")
          .single<RestaurantRow>(),
      );
      return rowToRestaurant(row);
    },

    async updateRestaurant(id, patch) {
      const p = { ...patch };
      if (p.slug !== undefined) {
        p.slug = p.slug.trim().toLowerCase();
        if (!isUsableRestaurantSlug(p.slug)) throw new RepositoryError("invalid", "Invalid or reserved slug");
      }
      if (p.customDomain !== undefined) {
        p.customDomain = normalizeDomain(p.customDomain);
        await assertDomainFormat(p.customDomain);
      }
      if (p.theme || p.contact) {
        const current = await requireRestaurant(id);
        if (p.theme) p.theme = { ...current.theme, ...p.theme };
        if (p.contact) p.contact = { ...current.contact, ...p.contact };
      }
      const changes = restaurantToRow(p);
      if (Object.keys(changes).length === 0) return requireRestaurant(id);
      const row = check(await restaurants().update(changes).eq("id", id).select("*").single<RestaurantRow>());
      return rowToRestaurant(row);
    },

    async deleteRestaurant(id) {
      const { data, error } = await restaurants().delete().eq("id", id).select("id");
      if (error) throw toRepositoryError(error);
      if (!data || data.length === 0) throw new RepositoryError("not_found", "Restaurant not found");
      await removeRestaurantFiles(id).catch(() => {});
    },

    async duplicateRestaurant(sourceId, input) {
      const source = await requireRestaurant(sourceId);
      const slug = input.slug.trim().toLowerCase();
      if (!(await slugAvailable(slug))) {
        throw new RepositoryError(isUsableRestaurantSlug(slug) ? "slug_taken" : "invalid");
      }
      const [srcCats, srcItems] = await Promise.all([repo.listCategories(sourceId), repo.listItems(sourceId)]);
      const newId = randomUUID();

      const newRestaurantRow = check(
        await restaurants()
          .insert({
            ...restaurantToRow({ ...source, slug, name: { ...input.name }, customDomain: null }),
            id: newId,
            logo_url: await copyImage(source.logoUrl, sourceId, newId),
            cover_url: await copyImage(source.coverUrl, sourceId, newId),
          })
          .select("*")
          .single<RestaurantRow>(),
      );

      try {
        const catIdMap = new Map<string, string>();
        const catRows = await Promise.all(
          srcCats.map(async (c) => {
            const id = randomUUID();
            catIdMap.set(c.id, id);
            return {
              ...categoryToRow(c),
              id,
              restaurant_id: newId,
              image_url: await copyImage(c.imageUrl, sourceId, newId),
            };
          }),
        );
        if (catRows.length) ok(await categories().insert(catRows));

        const itemRows = await Promise.all(
          srcItems
            .filter((i) => catIdMap.has(i.categoryId))
            .map(async (i) => ({
              ...itemToRow({ ...i, options: withOptionIds(i.options, true) }),
              id: randomUUID(),
              restaurant_id: newId,
              category_id: catIdMap.get(i.categoryId)!,
              image_url: await copyImage(i.imageUrl, sourceId, newId),
            })),
        );
        for (let k = 0; k < itemRows.length; k += 500) {
          ok(await items().insert(itemRows.slice(k, k + 500)));
        }
      } catch (err) {
        // Don't leave a half-copied restaurant behind.
        await restaurants().delete().eq("id", newId);
        await removeRestaurantFiles(newId).catch(() => {});
        throw err instanceof RepositoryError ? err : new RepositoryError("unknown", String(err));
      }
      return rowToRestaurant(newRestaurantRow);
    },

    async isSlugAvailable(slug) {
      return slugAvailable(slug.trim().toLowerCase());
    },

    /* ---------- categories ---------- */

    async createCategory(restaurantId, input) {
      const sortOrder = input.sortOrder ?? (await nextSortOrder("categories", "restaurant_id", restaurantId));
      const full: Omit<Category, "id" | "restaurantId"> = {
        ...categoryDefaults(),
        ...stripUndefined(input),
        name: { ...input.name },
        sortOrder,
      };
      const row = check(
        await categories()
          .insert({ id: randomUUID(), restaurant_id: restaurantId, ...categoryToRow(full) })
          .select("*")
          .single<CategoryRow>(),
      );
      return rowToCategory(row);
    },

    async updateCategory(id, patch) {
      const changes = categoryToRow(patch);
      if (Object.keys(changes).length === 0) return requireCategory(id);
      const row = check(await categories().update(changes).eq("id", id).select("*").single<CategoryRow>());
      return rowToCategory(row);
    },

    async deleteCategory(id) {
      // Items go with it (ON DELETE CASCADE on items.category_id).
      const { data, error } = await categories().delete().eq("id", id).select("id");
      if (error) throw toRepositoryError(error);
      if (!data || data.length === 0) throw new RepositoryError("not_found", "Category not found");
    },

    async reorderCategories(restaurantId, orderedIds) {
      ok(await sb.rpc("reorder_categories", { rid: restaurantId, ordered_ids: orderedIds }));
    },

    /* ---------- items ---------- */

    async createItem(restaurantId, input) {
      const category = await requireCategory(input.categoryId);
      if (category.restaurantId !== restaurantId) throw new RepositoryError("invalid", "Category belongs to another restaurant");
      const id = randomUUID();
      const [taken, sortOrder] = await Promise.all([
        itemSlugs(restaurantId),
        input.sortOrder ?? nextSortOrder("items", "category_id", category.id),
      ]);
      const wanted = input.slug ? slugify(input.slug, 60) : "";
      const slug = wanted && isValidItemSlug(wanted) && !taken.has(wanted) ? wanted : uniqueItemSlug(input.name, taken, shortId(id));
      const full: Omit<MenuItem, "id" | "restaurantId" | "createdAt" | "updatedAt"> = {
        ...itemDefaults(),
        ...stripUndefined(input),
        categoryId: category.id,
        name: { ...input.name },
        price: input.price,
        slug,
        options: withOptionIds(input.options),
        sortOrder,
      };
      const insert = (s: string) =>
        items()
          .insert({ id, restaurant_id: restaurantId, ...itemToRow({ ...full, slug: s }) })
          .select("*")
          .single<ItemRow>();
      let res = await insert(slug);
      if (res.error?.code === "23505") res = await insert(`${slug.slice(0, 50)}-${shortId(id)}`); // lost a race
      return rowToItem(check(res));
    },

    async updateItem(id, patch) {
      const p = { ...patch };
      const needsCurrent = p.slug !== undefined || p.categoryId !== undefined;
      const current = needsCurrent ? await requireItem(id) : null;
      if (current && p.categoryId !== undefined && p.categoryId !== current.categoryId) {
        const cat = await requireCategory(p.categoryId);
        if (cat.restaurantId !== current.restaurantId) throw new RepositoryError("invalid", "Category belongs to another restaurant");
        if (p.sortOrder === undefined) p.sortOrder = await nextSortOrder("items", "category_id", cat.id);
      }
      if (current && p.slug !== undefined && p.slug !== current.slug) {
        const wanted = slugify(p.slug, 60);
        if (!wanted || !isValidItemSlug(wanted)) throw new RepositoryError("invalid", "Invalid item slug");
        if ((await itemSlugs(current.restaurantId, id)).has(wanted)) throw new RepositoryError("slug_taken");
        p.slug = wanted;
      } else if (current && p.slug === current.slug) {
        delete p.slug;
      }
      if (p.options !== undefined) p.options = withOptionIds(p.options);
      const changes = itemToRow(p);
      if (Object.keys(changes).length === 0) return current ?? requireItem(id);
      const row = check(await items().update(changes).eq("id", id).select("*").single<ItemRow>());
      return rowToItem(row);
    },

    async deleteItem(id) {
      const { data, error } = await items().delete().eq("id", id).select("id");
      if (error) throw toRepositoryError(error);
      if (!data || data.length === 0) throw new RepositoryError("not_found", "Item not found");
    },

    async duplicateItem(id) {
      const source = await requireItem(id);
      const newId = randomUUID();
      const taken = await itemSlugs(source.restaurantId);
      const slug = uniqueItemSlug({ en: `${source.slug}-copy` }, taken, shortId(newId));
      const row = check(
        await items()
          .insert({
            ...itemToRow({ ...source, slug, options: withOptionIds(source.options, true), sortOrder: source.sortOrder + 1 }),
            id: newId,
            restaurant_id: source.restaurantId,
          })
          .select("*")
          .single<ItemRow>(),
      );
      // Place the copy right after the original.
      const siblings = check(
        await items().select("id").eq("category_id", source.categoryId).order("sort_order").order("created_at"),
      ) as Array<{ id: string }>;
      const order = siblings.map((s) => s.id).filter((sid) => sid !== newId);
      order.splice(order.indexOf(source.id) + 1, 0, newId);
      await repo.reorderItems(source.categoryId, order);
      return { ...rowToItem(row), sortOrder: order.indexOf(newId) };
    },

    async reorderItems(categoryId, orderedIds) {
      ok(await sb.rpc("reorder_items", { cid: categoryId, ordered_ids: orderedIds }));
    },

    /* ---------- images ---------- */

    async uploadImage(restaurantId, folder, file, contentType) {
      if (!IMAGE_FOLDERS.includes(folder)) throw new RepositoryError("invalid", "Unknown image folder");
      const ct = (contentType || file.type || "").split(";")[0].trim().toLowerCase();
      const ext = IMAGE_EXTENSIONS[ct];
      if (!ext) throw new RepositoryError("invalid", "Unsupported image type");
      if (file.size > MAX_UPLOAD_BYTES) throw new RepositoryError("invalid", "Image is too large");
      if (!/^[0-9a-f-]{36}$/i.test(restaurantId)) throw new RepositoryError("invalid", "Invalid restaurant id");
      const path = `${restaurantId}/${folder}/${randomUUID()}.${ext}`;
      const bucket = sb.storage.from(IMAGE_BUCKET);
      const { error } = await bucket.upload(path, file, {
        contentType: ct === "image/jpg" || ct === "image/pjpeg" ? "image/jpeg" : ct,
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) {
        const status = Number((error as { statusCode?: string | number }).statusCode ?? 0);
        throw new RepositoryError(status === 403 || status === 401 ? "forbidden" : "storage_failed", error.message);
      }
      return { url: bucket.getPublicUrl(path).data.publicUrl };
    },

    async deleteImage(url) {
      const path = storagePathOf(url);
      if (!path) return; // Foreign URL (demo asset, Unsplash): ignore.
      await sb.storage.from(IMAGE_BUCKET).remove([path]).catch(() => {});
    },

    /* ---------- members ---------- */

    async listMembers(restaurantId): Promise<MemberInfo[]> {
      const members = check(
        await sb.from("restaurant_members").select("user_id, role, created_at").eq("restaurant_id", restaurantId).order("created_at"),
      ) as Array<{ user_id: string; role: MemberInfo["role"] }>;
      if (members.length === 0) return [];
      const profiles = check(
        await sb.from("profiles").select("id, email").in("id", members.map((m) => m.user_id)),
      ) as Array<{ id: string; email: string | null }>;
      const emailOf = new Map(profiles.map((p) => [p.id, p.email ?? ""] as const));
      return members.map((m) => ({ userId: m.user_id, email: emailOf.get(m.user_id) ?? "", role: m.role }));
    },

    async listRestaurantSummaries() {
      const [counts, members] = await Promise.all([
        sb.rpc("restaurant_item_counts"),
        sb.from("restaurant_members").select("restaurant_id, user_id"),
      ]);
      const countRows = check(counts) as Array<{ restaurant_id: string; item_count: number | string }>;
      const memberRows = check(members) as Array<{ restaurant_id: string; user_id: string }>;
      const userIds = [...new Set(memberRows.map((m) => m.user_id))];
      const profiles = userIds.length
        ? (check(await sb.from("profiles").select("id, email").in("id", userIds)) as Array<{ id: string; email: string | null }>)
        : [];
      const emailOf = new Map(profiles.map((p) => [p.id, p.email ?? ""] as const));
      const out: Record<string, { itemCount: number; memberEmails: string[] }> = {};
      const entry = (id: string) => (out[id] ??= { itemCount: 0, memberEmails: [] });
      for (const c of countRows) entry(c.restaurant_id).itemCount = Number(c.item_count) || 0;
      for (const m of memberRows) {
        const email = emailOf.get(m.user_id);
        if (email) entry(m.restaurant_id).memberEmails.push(email);
      }
      return out;
    },

    async addMember(restaurantId, userId, role) {
      ok(
        await sb
          .from("restaurant_members")
          .upsert({ restaurant_id: restaurantId, user_id: userId, role }, { onConflict: "restaurant_id,user_id" }),
      );
    },

    async removeMember(restaurantId, userId) {
      ok(await sb.from("restaurant_members").delete().eq("restaurant_id", restaurantId).eq("user_id", userId));
    },
  };

  return repo;
}

/** Drops keys whose value is undefined so spreads don't erase defaults. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
