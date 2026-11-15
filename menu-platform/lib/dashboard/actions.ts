"use server";

import { updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { requireRestaurantAccess, setActiveRestaurantId } from "@/lib/auth";
import { menuTagsFor } from "@/lib/cache-tags";
import { getRepository, RepositoryError, type MenuRepository } from "@/lib/data";
import type { Category, ImageFolder, ItemOption, Locale, MenuItem, Restaurant } from "@/lib/data/types";
import { MAX_UPLOAD_BYTES, isAcceptedImageType } from "@/lib/images/validate";
import type { ActionResult, DashErrorKey } from "./result";
import {
  brandingSchema,
  categoryInputSchema,
  contactSchema,
  currencySchema,
  hoursSchema,
  timezoneSchema,
  idListSchema,
  idSchema,
  imageFolderSchema,
  infoSchema,
  itemInputSchema,
  itemQuickPatchSchema,
  langSchema,
  type BrandingInput,
  type CategoryInput,
  type ContactInput,
  type CurrencyInput,
  type HoursInput,
  type InfoInput,
  type ItemInput,
  type ItemQuickPatch,
} from "./schemas";

/**
 * Server actions of the restaurant owner dashboard.
 *
 * Every action: (1) validates lang + restaurantId, (2) calls requireRestaurantAccess FIRST
 * (redirects when signed out or not allowed), (3) checks that the category/item belongs to that
 * restaurant, (4) validates the payload with zod, (5) writes through getRepository("session"),
 * (6) calls updateTag() for every tag in menuTagsFor(restaurant) so the public menu and the
 * current dashboard page show the change immediately.
 *
 * Results are { ok: true, data } | { ok: false, error } where error is a key of
 * dashboard.json "errors" (the client shows the localized message).
 */

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

interface Ctx {
  lang: Locale;
  restaurant: Restaurant;
  repo: MenuRepository;
}

const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
const fail = (error: DashErrorKey): { ok: false; error: DashErrorKey } => ({ ok: false, error });

function errorKey(err: unknown): DashErrorKey {
  const code =
    err instanceof RepositoryError
      ? err.code
      : typeof err === "object" && err !== null && (err as { name?: unknown }).name === "RepositoryError"
        ? String((err as { code?: unknown }).code)
        : null;
  switch (code) {
    case "invalid":
      return "invalid";
    case "not_found":
      return "notFound";
    case "forbidden":
      return "forbidden";
    case "read_only":
      return "readOnly";
    case "slug_taken":
      return "slugTaken";
    case "domain_taken":
      return "domainTaken";
    case "storage_failed":
      return "storageFailed";
    default:
      return "unknown";
  }
}

/** Runs a write; maps expected repository errors to keys and rethrows Next.js control flow. */
async function guarded<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (err) {
    unstable_rethrow(err);
    const key = errorKey(err);
    if (key === "unknown") console.error("[dashboard action]", err);
    return fail(key);
  }
}

/**
 * Authorization gate used by every action. requireRestaurantAccess redirects (throws) when the
 * user is signed out or may not manage this restaurant. Returns null for malformed ids.
 */
async function authorize(lang: unknown, restaurantId: unknown): Promise<Ctx | DashErrorKey> {
  const l: Locale = langSchema.safeParse(lang).data ?? "ar";
  const rid = idSchema.safeParse(restaurantId);
  if (!rid.success) return "invalid";
  await requireRestaurantAccess(l, rid.data);
  const repo = await getRepository("session");
  let restaurant: Restaurant | null;
  try {
    restaurant = await repo.getRestaurantById(rid.data);
  } catch (err) {
    unstable_rethrow(err);
    return errorKey(err);
  }
  if (!restaurant) return "notFound";
  return { lang: l, restaurant, repo };
}

function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> | null {
  const res = schema.safeParse(value);
  return res.success ? res.data : null;
}

function invalidate(restaurant: Pick<Restaurant, "id" | "slug" | "customDomain">) {
  for (const tag of menuTagsFor(restaurant)) updateTag(tag);
}

async function loadItem(ctx: Ctx, itemId: unknown): Promise<MenuItem | null> {
  const id = idSchema.safeParse(itemId);
  if (!id.success) return null;
  const item = await ctx.repo.getItem(id.data);
  return item && item.restaurantId === ctx.restaurant.id ? item : null;
}

async function loadCategory(ctx: Ctx, categoryId: unknown): Promise<Category | null> {
  const id = idSchema.safeParse(categoryId);
  if (!id.success) return null;
  const category = await ctx.repo.getCategory(id.data);
  return category && category.restaurantId === ctx.restaurant.id ? category : null;
}

const BUCKET_PATH = "/storage/v1/object/public/menu-images/";

/** True when `url` is a file in THIS restaurant's own storage folder (local or the pinned Supabase project). */
function isOwnStorageUrl(url: string, restaurantId: string): boolean {
  if (url.startsWith(`/uploads/${restaurantId}/`)) return !url.includes("..") && !/[?#]/.test(url);
  try {
    const u = new URL(url);
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base || u.protocol !== "https:" || u.origin !== new URL(base).origin) return false;
    if (u.pathname.includes("..") || u.pathname.includes("//")) return false;
    return u.pathname.startsWith(`${BUCKET_PATH}${restaurantId}/`);
  } catch {
    return false;
  }
}

/**
 * A new image URL must be one we stored for THIS restaurant (local "/uploads/<rid>/..." or the
 * Supabase public bucket path in the configured project). Unchanged URLs (demo photos) are always fine.
 */
function isAllowedImage(next: string | null, previous: string | null, restaurantId: string): boolean {
  if (next === null || next === previous) return true;
  return isOwnStorageUrl(next, restaurantId);
}

/**
 * Best-effort removal of replaced or removed images. Call AFTER the write. Only files in the
 * acting restaurant's own folder are deleted, and only when no item, category, logo or cover of
 * the restaurant still references them (duplicated items share one file).
 */
async function dropImage(ctx: Ctx, urls: ReadonlyArray<string | null | undefined>) {
  const rid = ctx.restaurant.id;
  const candidates = [...new Set(urls.filter((u): u is string => Boolean(u) && isOwnStorageUrl(u as string, rid)))];
  if (candidates.length === 0) return;
  try {
    const [fresh, categories, items] = await Promise.all([
      ctx.repo.getRestaurantById(rid),
      ctx.repo.listCategories(rid),
      ctx.repo.listItems(rid),
    ]);
    const inUse = new Set<string>();
    for (const u of [fresh?.logoUrl, fresh?.coverUrl, ...categories.map((c) => c.imageUrl), ...items.map((i) => i.imageUrl)]) {
      if (u) inUse.add(u);
    }
    await Promise.all(candidates.filter((u) => !inUse.has(u)).map((u) => ctx.repo.deleteImage(u).catch(() => {})));
  } catch {
    // Orphaned files are harmless; never fail the save over cleanup.
  }
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

/**
 * Stores an image already compressed in the browser. FormData fields:
 * lang, restaurantId, folder ("logo" | "cover" | "category" | "item"), file.
 */
export async function uploadImageAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const ctx = await authorize(formData.get("lang"), formData.get("restaurantId"));
  if (typeof ctx === "string") return fail(ctx);
  const folder = parse(imageFolderSchema, formData.get("folder")) as ImageFolder | null;
  const file = formData.get("file");
  if (!folder || !(file instanceof File)) return fail("invalid");
  const type = (file.type || "").toLowerCase();
  if (!isAcceptedImageType(type)) return fail("imageType");
  // SVG can carry scripts: only logos may be SVG.
  if (type === "image/svg+xml" && folder !== "logo") return fail("imageType");
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) return fail("imageTooLarge");
  return guarded(async () => {
    const { url } = await ctx.repo.uploadImage(ctx.restaurant.id, folder, file, type);
    return { url };
  });
}

/** Deletes an uploaded image that was never saved (e.g. the owner cancelled the form). */
export async function discardUploadAction(lang: Locale, restaurantId: string, url: string): Promise<ActionResult> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  if (typeof url !== "string" || !url || !isAllowedImage(url, null, ctx.restaurant.id)) return fail("invalid");
  // dropImage never deletes an image still used by the restaurant, a category or an item.
  return guarded(async () => {
    await dropImage(ctx, [url]);
    return null;
  });
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

/** Quick inline edits: sold out, featured, price / old price, size prices. */
export async function patchItemAction(
  lang: Locale,
  restaurantId: string,
  itemId: string,
  patch: ItemQuickPatch,
): Promise<ActionResult<MenuItem>> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  const data = parse(itemQuickPatchSchema, patch);
  if (!data) return fail("invalid");
  const item = await loadItem(ctx, itemId);
  if (!item) return fail("notFound");

  const next: Partial<MenuItem> = {};
  if (data.isAvailable !== undefined) next.isAvailable = data.isAvailable;
  if (data.isFeatured !== undefined) next.isFeatured = data.isFeatured;
  if (data.optionPrices) {
    const prices = new Map(data.optionPrices.map((o) => [o.id, o.price]));
    next.options = item.options.map((o): ItemOption => ({ ...o, price: prices.get(o.id) ?? o.price }));
  }
  const sized = next.options ?? item.options;
  if (sized.length > 0) {
    // Sized items: the base price is always the cheapest size (same rule as the item editor).
    next.price = Math.min(...sized.map((o) => o.price));
  } else if (data.price !== undefined) {
    next.price = data.price;
  }
  if (data.oldPrice !== undefined) next.oldPrice = data.oldPrice;
  const price = next.price ?? item.price;
  const oldPrice = next.oldPrice !== undefined ? next.oldPrice : item.oldPrice;
  if (oldPrice !== null && oldPrice <= price) {
    if (data.oldPrice !== undefined) return fail("invalid");
    next.oldPrice = null; // New price is above the old one: the offer ends.
  }
  return guarded(async () => {
    const updated = await ctx.repo.updateItem(item.id, next);
    invalidate(ctx.restaurant);
    return updated;
  });
}

/** Creates (itemId null) or fully updates an item from the item editor. */
export async function saveItemAction(
  lang: Locale,
  restaurantId: string,
  itemId: string | null,
  input: ItemInput,
): Promise<ActionResult<{ id: string; categoryId: string }>> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  const data = parse(itemInputSchema, input);
  if (!data) return fail("invalid");
  const category = await loadCategory(ctx, data.categoryId);
  if (!category) return fail("notFound");

  const existing = itemId === null ? null : await loadItem(ctx, itemId);
  if (itemId !== null && !existing) return fail("notFound");
  if (!isAllowedImage(data.imageUrl, existing?.imageUrl ?? null, ctx.restaurant.id)) return fail("invalid");

  const fields = {
    categoryId: category.id,
    name: data.name,
    description: data.description,
    price: data.price,
    oldPrice: data.oldPrice,
    imageUrl: data.imageUrl,
    imageBlur: data.imageUrl ? data.imageBlur : null,
    options: data.options.map((o) => ({ id: o.id ?? "", name: o.name, price: o.price })),
    tags: [...new Set(data.tags)],
    calories: data.calories,
    isAvailable: data.isAvailable,
    isFeatured: data.isFeatured,
  };

  return guarded(async () => {
    let saved: MenuItem;
    if (existing) {
      saved = await ctx.repo.updateItem(existing.id, fields);
      if (existing.imageUrl !== saved.imageUrl) await dropImage(ctx, [existing.imageUrl]);
    } else {
      saved = await ctx.repo.createItem(ctx.restaurant.id, fields);
    }
    invalidate(ctx.restaurant);
    return { id: saved.id, categoryId: saved.categoryId };
  });
}

export async function duplicateItemAction(
  lang: Locale,
  restaurantId: string,
  itemId: string,
): Promise<ActionResult<MenuItem>> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  const item = await loadItem(ctx, itemId);
  if (!item) return fail("notFound");
  return guarded(async () => {
    const copy = await ctx.repo.duplicateItem(item.id);
    invalidate(ctx.restaurant);
    return copy;
  });
}

export async function deleteItemAction(lang: Locale, restaurantId: string, itemId: string): Promise<ActionResult> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  const item = await loadItem(ctx, itemId);
  if (!item) return fail("notFound");
  return guarded(async () => {
    await ctx.repo.deleteItem(item.id);
    // Duplicated items share the photo URL: dropImage keeps it while anything else uses it.
    await dropImage(ctx, [item.imageUrl]);
    invalidate(ctx.restaurant);
    return null;
  });
}

export async function reorderItemsAction(
  lang: Locale,
  restaurantId: string,
  categoryId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  const ids = parse(idListSchema, orderedIds);
  if (!ids) return fail("invalid");
  const category = await loadCategory(ctx, categoryId);
  if (!category) return fail("notFound");
  return guarded(async () => {
    const items = await ctx.repo.listItems(ctx.restaurant.id, { categoryId: category.id });
    const own = new Set(items.map((i) => i.id));
    if (!ids.every((id) => own.has(id))) throw new RepositoryError("invalid");
    await ctx.repo.reorderItems(category.id, ids);
    invalidate(ctx.restaurant);
    return null;
  });
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

/** Creates (categoryId null) or updates a category. */
export async function saveCategoryAction(
  lang: Locale,
  restaurantId: string,
  categoryId: string | null,
  input: CategoryInput,
): Promise<ActionResult<Category>> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  const data = parse(categoryInputSchema, input);
  if (!data) return fail("invalid");
  const existing = categoryId === null ? null : await loadCategory(ctx, categoryId);
  if (categoryId !== null && !existing) return fail("notFound");
  if (!isAllowedImage(data.imageUrl, existing?.imageUrl ?? null, ctx.restaurant.id)) return fail("invalid");
  const fields = { ...data, imageBlur: data.imageUrl ? data.imageBlur : null };
  return guarded(async () => {
    let saved: Category;
    if (existing) {
      saved = await ctx.repo.updateCategory(existing.id, fields);
      if (existing.imageUrl !== saved.imageUrl) await dropImage(ctx, [existing.imageUrl]);
    } else {
      saved = await ctx.repo.createCategory(ctx.restaurant.id, fields);
    }
    invalidate(ctx.restaurant);
    return saved;
  });
}

export async function setCategoryVisibilityAction(
  lang: Locale,
  restaurantId: string,
  categoryId: string,
  isVisible: boolean,
): Promise<ActionResult> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  if (typeof isVisible !== "boolean") return fail("invalid");
  const category = await loadCategory(ctx, categoryId);
  if (!category) return fail("notFound");
  return guarded(async () => {
    await ctx.repo.updateCategory(category.id, { isVisible });
    invalidate(ctx.restaurant);
    return null;
  });
}

/** Deletes a category AND its items (and their uploaded photos). */
export async function deleteCategoryAction(
  lang: Locale,
  restaurantId: string,
  categoryId: string,
): Promise<ActionResult> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  const category = await loadCategory(ctx, categoryId);
  if (!category) return fail("notFound");
  return guarded(async () => {
    const items = await ctx.repo.listItems(ctx.restaurant.id, { categoryId: category.id });
    await ctx.repo.deleteCategory(category.id);
    await dropImage(ctx, [category.imageUrl, ...items.map((i) => i.imageUrl)]);
    invalidate(ctx.restaurant);
    return null;
  });
}

export async function reorderCategoriesAction(
  lang: Locale,
  restaurantId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  const ids = parse(idListSchema, orderedIds);
  if (!ids) return fail("invalid");
  return guarded(async () => {
    const categories = await ctx.repo.listCategories(ctx.restaurant.id);
    const own = new Set(categories.map((c) => c.id));
    if (!ids.every((id) => own.has(id))) throw new RepositoryError("invalid");
    await ctx.repo.reorderCategories(ctx.restaurant.id, ids);
    invalidate(ctx.restaurant);
    return null;
  });
}

/* ------------------------------------------------------------------ */
/* Restaurant settings (never plan / isActive / slug / customDomain)  */
/* ------------------------------------------------------------------ */

export async function saveBrandingAction(
  lang: Locale,
  restaurantId: string,
  input: BrandingInput,
): Promise<ActionResult> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  const data = parse(brandingSchema, input);
  if (!data) return fail("invalid");
  const r = ctx.restaurant;
  if (!isAllowedImage(data.logoUrl, r.logoUrl, r.id) || !isAllowedImage(data.coverUrl, r.coverUrl, r.id)) {
    return fail("invalid");
  }
  return guarded(async () => {
    const saved = await ctx.repo.updateRestaurant(r.id, {
      logoUrl: data.logoUrl,
      coverUrl: data.coverUrl,
      coverBlur: data.coverUrl ? data.coverBlur : null,
      theme: data.theme,
    });
    if (r.logoUrl !== saved.logoUrl || r.coverUrl !== saved.coverUrl) await dropImage(ctx, [r.logoUrl, r.coverUrl]);
    invalidate(r);
    return null;
  });
}

export async function saveInfoAction(lang: Locale, restaurantId: string, input: InfoInput): Promise<ActionResult> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  const data = parse(infoSchema, input);
  if (!data) return fail("invalid");
  return guarded(async () => {
    await ctx.repo.updateRestaurant(ctx.restaurant.id, {
      name: data.name,
      tagline: data.tagline,
      description: data.description,
    });
    invalidate(ctx.restaurant);
    return null;
  });
}

export async function saveContactAction(
  lang: Locale,
  restaurantId: string,
  input: ContactInput,
): Promise<ActionResult> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  const data = parse(contactSchema, input);
  if (!data) return fail("invalid");
  return guarded(async () => {
    await ctx.repo.updateRestaurant(ctx.restaurant.id, { contact: data });
    invalidate(ctx.restaurant);
    return null;
  });
}

export async function saveTimezoneAction(lang: Locale, restaurantId: string, timezone: string): Promise<ActionResult> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  const data = parse(timezoneSchema, timezone);
  if (!data) return fail("invalid");
  return guarded(async () => {
    await ctx.repo.updateRestaurant(ctx.restaurant.id, { timezone: data });
    invalidate(ctx.restaurant);
    return null;
  });
}

export async function saveHoursAction(lang: Locale, restaurantId: string, input: HoursInput): Promise<ActionResult> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  const data = parse(hoursSchema, input);
  if (!data) return fail("invalid");
  return guarded(async () => {
    await ctx.repo.updateRestaurant(ctx.restaurant.id, { openingHours: data });
    invalidate(ctx.restaurant);
    return null;
  });
}

export async function saveCurrencyAction(
  lang: Locale,
  restaurantId: string,
  input: CurrencyInput,
): Promise<ActionResult> {
  const ctx = await authorize(lang, restaurantId);
  if (typeof ctx === "string") return fail(ctx);
  const data = parse(currencySchema, input);
  if (!data) return fail("invalid");
  return guarded(async () => {
    await ctx.repo.updateRestaurant(ctx.restaurant.id, {
      currency: data.currency,
      secondaryCurrency: data.secondaryCurrency,
      exchangeRate: data.exchangeRate,
    });
    invalidate(ctx.restaurant);
    return null;
  });
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

/** Switches the restaurant the dashboard shows (member of it, or platform admin). */
export async function switchRestaurantAction(lang: Locale, restaurantId: string): Promise<ActionResult> {
  const l: Locale = langSchema.safeParse(lang).data ?? "ar";
  const rid = idSchema.safeParse(restaurantId);
  if (!rid.success) return fail("invalid");
  await requireRestaurantAccess(l, rid.data);
  return guarded(async () => {
    await setActiveRestaurantId(rid.data);
    return null;
  });
}
