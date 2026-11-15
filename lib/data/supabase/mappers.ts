import type {
  Category,
  CategoryPatch,
  ItemOption,
  ItemPatch,
  ItemTag,
  MenuItem,
  OpeningHours,
  Restaurant,
  RestaurantContact,
  RestaurantPatch,
  RestaurantTheme,
} from "../types";
import { DEFAULT_THEME, EMPTY_CONTACT } from "../local/defaults";

/**
 * snake_case database rows <-> camelCase domain types (see supabase/migrations/0001_init.sql).
 */

export interface RestaurantRow {
  id: string;
  slug: string;
  custom_domain: string | null;
  name_ar: string;
  name_en: string;
  tagline_ar: string;
  tagline_en: string;
  description_ar: string;
  description_en: string;
  logo_url: string | null;
  cover_url: string | null;
  cover_blur: string | null;
  theme: Partial<RestaurantTheme> | null;
  currency: string;
  secondary_currency: string | null;
  exchange_rate: number | string | null;
  contact: Partial<RestaurantContact> | null;
  opening_hours: OpeningHours | null;
  timezone: string | null;
  is_active: boolean;
  plan: Restaurant["plan"];
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  restaurant_id: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  image_url: string | null;
  image_blur: string | null;
  icon: string | null;
  sort_order: number;
  is_visible: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ItemRow {
  id: string;
  restaurant_id: string;
  category_id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  price: number | string;
  old_price: number | string | null;
  image_url: string | null;
  image_blur: string | null;
  options: ItemOption[] | null;
  tags: string[] | null;
  calories: number | null;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

const toIso = (v: string | null | undefined): string => (v ? new Date(v).toISOString() : new Date(0).toISOString());

/** Sets `row[key]` only when `value` is not undefined (partial updates). */
function put<R extends object>(row: Partial<R>, key: keyof R, value: unknown) {
  if (value !== undefined) (row as Record<string, unknown>)[key as string] = value;
}

/* ---------------------------------- restaurants ---------------------------------- */

export function rowToRestaurant(row: RestaurantRow): Restaurant {
  const contact = { ...EMPTY_CONTACT, ...(row.contact ?? {}) };
  return {
    id: row.id,
    slug: row.slug,
    customDomain: row.custom_domain,
    name: { ar: row.name_ar ?? "", en: row.name_en ?? "" },
    tagline: { ar: row.tagline_ar ?? "", en: row.tagline_en ?? "" },
    description: { ar: row.description_ar ?? "", en: row.description_en ?? "" },
    logoUrl: row.logo_url,
    coverUrl: row.cover_url,
    coverBlur: row.cover_blur,
    theme: { ...DEFAULT_THEME, ...(row.theme ?? {}) },
    currency: row.currency,
    secondaryCurrency: row.secondary_currency,
    exchangeRate: num(row.exchange_rate),
    contact: { ...contact, address: { ar: contact.address?.ar ?? "", en: contact.address?.en ?? "" } },
    openingHours: row.opening_hours ?? {},
    timezone: row.timezone || "Asia/Damascus",
    isActive: row.is_active,
    plan: row.plan,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function restaurantToRow(p: RestaurantPatch): Partial<RestaurantRow> {
  const row: Partial<RestaurantRow> = {};
  put(row, "slug", p.slug);
  put(row, "custom_domain", p.customDomain);
  put(row, "name_ar", p.name?.ar);
  put(row, "name_en", p.name?.en);
  put(row, "tagline_ar", p.tagline?.ar);
  put(row, "tagline_en", p.tagline?.en);
  put(row, "description_ar", p.description?.ar);
  put(row, "description_en", p.description?.en);
  put(row, "logo_url", p.logoUrl);
  put(row, "cover_url", p.coverUrl);
  put(row, "cover_blur", p.coverBlur);
  put(row, "theme", p.theme);
  put(row, "currency", p.currency);
  put(row, "secondary_currency", p.secondaryCurrency);
  put(row, "exchange_rate", p.exchangeRate);
  put(row, "contact", p.contact);
  put(row, "opening_hours", p.openingHours);
  put(row, "timezone", p.timezone);
  put(row, "is_active", p.isActive);
  put(row, "plan", p.plan);
  return row;
}

/* ---------------------------------- categories ---------------------------------- */

export function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: { ar: row.name_ar ?? "", en: row.name_en ?? "" },
    description: { ar: row.description_ar ?? "", en: row.description_en ?? "" },
    imageUrl: row.image_url,
    imageBlur: row.image_blur,
    icon: row.icon,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
  };
}

export function categoryToRow(p: CategoryPatch): Partial<CategoryRow> {
  const row: Partial<CategoryRow> = {};
  put(row, "name_ar", p.name?.ar);
  put(row, "name_en", p.name?.en);
  put(row, "description_ar", p.description?.ar);
  put(row, "description_en", p.description?.en);
  put(row, "image_url", p.imageUrl);
  put(row, "image_blur", p.imageBlur);
  put(row, "icon", p.icon);
  put(row, "sort_order", p.sortOrder);
  put(row, "is_visible", p.isVisible);
  return row;
}

/* ------------------------------------- items ------------------------------------- */

export function rowToItem(row: ItemRow): MenuItem {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    categoryId: row.category_id,
    slug: row.slug,
    name: { ar: row.name_ar ?? "", en: row.name_en ?? "" },
    description: { ar: row.description_ar ?? "", en: row.description_en ?? "" },
    price: num(row.price) ?? 0,
    oldPrice: num(row.old_price),
    imageUrl: row.image_url,
    imageBlur: row.image_blur,
    options: (row.options ?? []).map((o) => ({
      id: String(o.id ?? ""),
      name: { ar: o.name?.ar ?? "", en: o.name?.en ?? "" },
      price: Number(o.price ?? 0),
    })),
    tags: (row.tags ?? []) as ItemTag[],
    calories: row.calories,
    isAvailable: row.is_available,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function itemToRow(p: ItemPatch): Partial<ItemRow> {
  const row: Partial<ItemRow> = {};
  put(row, "category_id", p.categoryId);
  put(row, "slug", p.slug);
  put(row, "name_ar", p.name?.ar);
  put(row, "name_en", p.name?.en);
  put(row, "description_ar", p.description?.ar);
  put(row, "description_en", p.description?.en);
  put(row, "price", p.price);
  put(row, "old_price", p.oldPrice);
  put(row, "image_url", p.imageUrl);
  put(row, "image_blur", p.imageBlur);
  put(row, "options", p.options);
  put(row, "tags", p.tags);
  put(row, "calories", p.calories);
  put(row, "is_available", p.isAvailable);
  put(row, "is_featured", p.isFeatured);
  put(row, "sort_order", p.sortOrder);
  return row;
}
