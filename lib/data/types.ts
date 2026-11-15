/**
 * Domain types shared by the whole app (public menu, dashboard, admin, data layer).
 * The database uses snake_case columns (name_ar, name_en, ...); the data layer maps
 * rows to these camelCase types. UI code only ever sees these types.
 */

export type Locale = "ar" | "en";

/** A piece of text in both languages. Either side may be "" (UI falls back to the other). */
export interface LocalizedText {
  ar: string;
  en: string;
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

/** Public-menu layout templates. Each is a different look on the same code. */
export type TemplateId = "aurora" | "noir" | "pop";
export const TEMPLATE_IDS: TemplateId[] = ["aurora", "noir", "pop"];

export type ColorMode = "light" | "dark" | "system";

/** Font families the menu can use (CSS variables are defined in lib/fonts.ts). */
export type FontId = "cairo" | "tajawal" | "ibm-plex" | "readex" | "el-messiri";
export const FONT_IDS: FontId[] = ["cairo", "tajawal", "ibm-plex", "readex", "el-messiri"];

export type RadiusId = "sharp" | "soft" | "round";

export interface RestaurantTheme {
  template: TemplateId;
  /** Brand color, hex like "#C2410C". */
  primary: string;
  /** Secondary accent, hex. */
  accent: string;
  /** Default color mode when the guest has not chosen one. */
  mode: ColorMode;
  font: FontId;
  radius: RadiusId;
}

/* ------------------------------------------------------------------ */
/* Restaurant                                                          */
/* ------------------------------------------------------------------ */

/** ISO 4217 code. Common ones listed in CURRENCIES. */
export type CurrencyCode = string;

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: LocalizedText;
  /** Decimal places to show (SYP/LBP/IQD use 0). */
  decimals: number;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: { ar: "$", en: "$" }, decimals: 2 },
  { code: "SYP", symbol: { ar: "ل.س", en: "SYP" }, decimals: 0 },
  { code: "EUR", symbol: { ar: "€", en: "€" }, decimals: 2 },
  { code: "LBP", symbol: { ar: "ل.ل", en: "LBP" }, decimals: 0 },
  { code: "TRY", symbol: { ar: "₺", en: "₺" }, decimals: 2 },
  { code: "AED", symbol: { ar: "د.إ", en: "AED" }, decimals: 2 },
  { code: "SAR", symbol: { ar: "ر.س", en: "SAR" }, decimals: 2 },
  { code: "JOD", symbol: { ar: "د.أ", en: "JOD" }, decimals: 2 },
  { code: "IQD", symbol: { ar: "د.ع", en: "IQD" }, decimals: 0 },
  { code: "EGP", symbol: { ar: "ج.م", en: "EGP" }, decimals: 2 },
];

export type DayKey = "sat" | "sun" | "mon" | "tue" | "wed" | "thu" | "fri";
export const DAY_KEYS: DayKey[] = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];

/** "HH:MM" 24h. close < open means it closes after midnight. */
export interface DayHours {
  open: string;
  close: string;
  closed?: boolean;
}
export type OpeningHours = Partial<Record<DayKey, DayHours>>;

export interface RestaurantContact {
  whatsapp: string | null; // international format, digits only, e.g. "963912345678"
  phone: string | null;
  email: string | null;
  address: LocalizedText;
  mapsUrl: string | null;
  instagram: string | null; // full URL
  facebook: string | null; // full URL
  tiktok: string | null; // full URL
  website: string | null;
}

export type Plan = "trial" | "basic" | "pro";

export const DEFAULT_TIMEZONE = "Asia/Damascus";

/** Time zones offered first in the dashboard (any valid IANA zone is accepted). */
export const COMMON_TIMEZONES: string[] = [
  "Asia/Damascus",
  "Asia/Beirut",
  "Asia/Amman",
  "Asia/Baghdad",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Kuwait",
  "Asia/Qatar",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Europe/Berlin",
  "Europe/London",
];

export interface Restaurant {
  id: string;
  /** URL id and subdomain: lowercase a-z, 0-9, "-" (no dots). */
  slug: string;
  /** e.g. "menu.client.com" or null. */
  customDomain: string | null;
  name: LocalizedText;
  tagline: LocalizedText;
  description: LocalizedText;
  logoUrl: string | null;
  coverUrl: string | null;
  /** Tiny base64 data URL used as a blurred placeholder while the cover loads. */
  coverBlur: string | null;
  theme: RestaurantTheme;
  /** Main currency all prices are stored in. */
  currency: CurrencyCode;
  /** Optional second currency guests can switch to. */
  secondaryCurrency: CurrencyCode | null;
  /** 1 unit of `currency` = exchangeRate units of `secondaryCurrency`. */
  exchangeRate: number | null;
  contact: RestaurantContact;
  openingHours: OpeningHours;
  /** IANA time zone of the restaurant (e.g. "Asia/Damascus"), used for "open now" and today's hours. */
  timezone: string;
  isActive: boolean;
  plan: Plan;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

export interface Category {
  id: string;
  restaurantId: string;
  name: LocalizedText;
  description: LocalizedText;
  imageUrl: string | null;
  imageBlur: string | null;
  /** lucide icon name in kebab-case (e.g. "coffee", "pizza") or null. */
  icon: string | null;
  sortOrder: number;
  isVisible: boolean;
}

export type ItemTag =
  | "new"
  | "popular"
  | "spicy"
  | "vegetarian"
  | "vegan"
  | "gluten_free"
  | "chef_pick";
export const ITEM_TAGS: ItemTag[] = [
  "new",
  "popular",
  "spicy",
  "vegetarian",
  "vegan",
  "gluten_free",
  "chef_pick",
];

/** A size or variant with its own price (e.g. Small / Medium / Large). */
export interface ItemOption {
  id: string;
  name: LocalizedText;
  price: number;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  /** Unique within the restaurant; used in shareable item URLs. */
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  /** Price in restaurant.currency. If options exist, this is the "from" price. */
  price: number;
  /** Original price before an offer, or null when not on offer. */
  oldPrice: number | null;
  imageUrl: string | null;
  imageBlur: string | null;
  options: ItemOption[];
  tags: ItemTag[];
  calories: number | null;
  /** false = sold out (still shown, dimmed). */
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Everything the public menu needs, in one object. */
export interface PublicMenu {
  restaurant: Restaurant;
  /** Visible categories only, sorted; each with its items sorted (sold-out items included). */
  categories: Array<Category & { items: MenuItem[] }>;
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export type MemberRole = "owner" | "staff";

export interface Membership {
  restaurantId: string;
  role: MemberRole;
}

export interface AppUser {
  id: string;
  email: string;
  displayName: string | null;
  isPlatformAdmin: boolean;
  memberships: Membership[];
}

/* ------------------------------------------------------------------ */
/* Mutation inputs                                                     */
/* ------------------------------------------------------------------ */

export type NewRestaurantInput = Pick<Restaurant, "slug" | "name"> &
  Partial<Omit<Restaurant, "id" | "slug" | "name" | "createdAt" | "updatedAt">>;
export type RestaurantPatch = Partial<Omit<Restaurant, "id" | "createdAt" | "updatedAt">>;

export type NewCategoryInput = Pick<Category, "name"> &
  Partial<Omit<Category, "id" | "restaurantId" | "name">>;
export type CategoryPatch = Partial<Omit<Category, "id" | "restaurantId">>;

export type NewItemInput = Pick<MenuItem, "categoryId" | "name" | "price"> &
  Partial<Omit<MenuItem, "id" | "restaurantId" | "categoryId" | "name" | "price" | "createdAt" | "updatedAt">>;
export type ItemPatch = Partial<Omit<MenuItem, "id" | "restaurantId" | "createdAt" | "updatedAt">>;

export type ImageFolder = "logo" | "cover" | "category" | "item";

export interface MemberInfo {
  userId: string;
  email: string;
  role: MemberRole;
}
