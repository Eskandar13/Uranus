import { DEFAULT_TIMEZONE, type Category, type MenuItem, type Restaurant, type RestaurantContact, type RestaurantTheme } from "../types";

/** Defaults for new records (shared by the local and Supabase repositories). */

export const DEFAULT_THEME: RestaurantTheme = {
  template: "aurora",
  primary: "#C2410C",
  accent: "#0F766E",
  mode: "light",
  font: "cairo",
  radius: "round",
};

export const EMPTY_CONTACT: RestaurantContact = {
  whatsapp: null,
  phone: null,
  email: null,
  address: { ar: "", en: "" },
  mapsUrl: null,
  instagram: null,
  facebook: null,
  tiktok: null,
  website: null,
};

export const EMPTY_TEXT = { ar: "", en: "" } as const;

/** Lowercases a custom domain, strips scheme, path, port, trailing dot; "" -> null. */
export function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  let d = domain.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, "");
  d = d.split(/[/?#]/)[0] ?? "";
  d = d.replace(/:\d+$/, "").replace(/\.$/, "");
  return d || null;
}

export function restaurantDefaults(): Omit<Restaurant, "id" | "slug" | "name" | "createdAt" | "updatedAt"> {
  return {
    customDomain: null,
    tagline: { ...EMPTY_TEXT },
    description: { ...EMPTY_TEXT },
    logoUrl: null,
    coverUrl: null,
    coverBlur: null,
    theme: { ...DEFAULT_THEME },
    currency: "USD",
    secondaryCurrency: null,
    exchangeRate: null,
    contact: { ...EMPTY_CONTACT, address: { ...EMPTY_TEXT } },
    openingHours: {},
    timezone: DEFAULT_TIMEZONE,
    isActive: true,
    plan: "trial",
  };
}

export function categoryDefaults(): Omit<Category, "id" | "restaurantId" | "name" | "sortOrder"> {
  return {
    description: { ...EMPTY_TEXT },
    imageUrl: null,
    imageBlur: null,
    icon: null,
    isVisible: true,
  };
}

export function itemDefaults(): Omit<
  MenuItem,
  "id" | "restaurantId" | "categoryId" | "slug" | "name" | "price" | "sortOrder" | "createdAt" | "updatedAt"
> {
  return {
    description: { ...EMPTY_TEXT },
    oldPrice: null,
    imageUrl: null,
    imageBlur: null,
    options: [],
    tags: [],
    calories: null,
    isAvailable: true,
    isFeatured: false,
  };
}
