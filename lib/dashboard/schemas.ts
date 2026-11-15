/**
 * zod v4 schemas for every dashboard mutation. Used twice:
 *   - server actions (lib/dashboard/actions.ts) validate untrusted input with them;
 *   - forms run the same schema in the browser to show inline errors before saving.
 * Issue messages are keys into the "validation" object of messages/{ar,en}/dashboard.json.
 * Pure module: no server-only imports.
 */
import { z } from "zod";
import {
  CURRENCIES,
  DAY_KEYS,
  FONT_IDS,
  ITEM_TAGS,
  TEMPLATE_IDS,
  type DayKey,
  type ImageFolder,
} from "@/lib/data/types";

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

export const langSchema = z.enum(["ar", "en"]);

/** Ids of restaurants, categories and items (UUIDs in practice; kept lenient but safe). */
export const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export const idListSchema = z.array(idSchema).max(1000);

export const IMAGE_FOLDERS: ImageFolder[] = ["logo", "cover", "category", "item"];
export const imageFolderSchema = z.enum(["logo", "cover", "category", "item"]);

const text = (max: number) => z.string().trim().max(max, "tooLong");

/** Both languages, each optional. */
export const localizedSchema = (max = 120) => z.object({ ar: text(max), en: text(max) });

/** Both languages, at least one filled in. */
export const requiredLocalizedSchema = (max = 120) =>
  localizedSchema(max).refine((v) => v.ar.length > 0 || v.en.length > 0, { error: "nameRequired", path: ["ar"] });

export const MAX_PRICE = 1_000_000_000;
export const moneySchema = z.number("price").min(0, "price").max(MAX_PRICE, "price");

/** Image URL as returned by uploadImageAction, an existing URL, or null. The action checks origin. */
export const imageUrlSchema = z.string().trim().min(1).max(2048).nullable();

/** Tiny base64 placeholder made by makeBlurDataUrl (or null). */
export const blurSchema = z
  .string()
  .max(8000)
  .regex(/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/)
  .nullable();

export const hexColorSchema = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "color");

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time");

const currencyCodes = CURRENCIES.map((c) => c.code) as [string, ...string[]];
export const currencyCodeSchema = z.enum(currencyCodes);

/** "" -> null; adds https:// when missing; must be an http(s) URL with a dotted host. */
export function normalizeUrl(value: string | null | undefined): string | null | undefined {
  const v = (value ?? "").trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
  try {
    const u = new URL(withScheme);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname.includes(".")) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

const urlField = z
  .string()
  .max(500, "tooLong")
  .nullable()
  .transform((value, ctx) => {
    const out = normalizeUrl(value);
    if (out === undefined) {
      ctx.addIssue({ code: "custom", message: "url" });
      return z.NEVER;
    }
    return out;
  });

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

export const itemOptionSchema = z.object({
  id: z.string().max(64).optional(),
  name: requiredLocalizedSchema(60),
  price: moneySchema,
});

export const itemInputSchema = z
  .object({
    categoryId: idSchema,
    name: requiredLocalizedSchema(120),
    description: localizedSchema(600),
    price: moneySchema,
    oldPrice: moneySchema.nullable(),
    imageUrl: imageUrlSchema,
    imageBlur: blurSchema,
    options: z.array(itemOptionSchema).max(20),
    tags: z.array(z.enum(ITEM_TAGS)).max(ITEM_TAGS.length),
    calories: z.int("calories").min(0, "calories").max(20000, "calories").nullable(),
    isAvailable: z.boolean(),
    isFeatured: z.boolean(),
  })
  .refine((v) => v.oldPrice === null || v.oldPrice > v.price, { error: "oldPrice", path: ["oldPrice"] });

export type ItemInput = z.infer<typeof itemInputSchema>;

/** Quick inline edits from the menu list. */
export const itemQuickPatchSchema = z
  .object({
    isAvailable: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    price: moneySchema.optional(),
    oldPrice: moneySchema.nullable().optional(),
    /** New prices for existing sizes, matched by option id. */
    optionPrices: z.array(z.object({ id: z.string().min(1).max(64), price: moneySchema })).max(20).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { error: "invalid" })
  .refine((v) => v.oldPrice == null || v.price === undefined || v.oldPrice > v.price, {
    error: "oldPrice",
    path: ["oldPrice"],
  });

export type ItemQuickPatch = z.infer<typeof itemQuickPatchSchema>;

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export const categoryInputSchema = z.object({
  name: requiredLocalizedSchema(80),
  description: localizedSchema(300),
  icon: z
    .string()
    .max(40)
    .regex(/^[a-z0-9-]+$/)
    .nullable(),
  imageUrl: imageUrlSchema,
  imageBlur: blurSchema,
  isVisible: z.boolean(),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

/* ------------------------------------------------------------------ */
/* Restaurant settings (owners never send plan / isActive / slug / customDomain) */
/* ------------------------------------------------------------------ */

export const themeSchema = z.object({
  template: z.enum(TEMPLATE_IDS),
  primary: hexColorSchema,
  accent: hexColorSchema,
  mode: z.enum(["light", "dark", "system"]),
  font: z.enum(FONT_IDS),
  radius: z.enum(["sharp", "soft", "round"]),
});

export const brandingSchema = z.object({
  logoUrl: imageUrlSchema,
  coverUrl: imageUrlSchema,
  coverBlur: blurSchema,
  theme: themeSchema,
});
export type BrandingInput = z.infer<typeof brandingSchema>;

export const infoSchema = z.object({
  name: requiredLocalizedSchema(80),
  tagline: localizedSchema(140),
  description: localizedSchema(800),
});
export type InfoInput = z.infer<typeof infoSchema>;

export const contactSchema = z.object({
  whatsapp: z
    .string()
    .max(30, "tooLong")
    .nullable()
    .transform((value, ctx) => {
      const digits = (value ?? "").replace(/[\s()+-]/g, "").replace(/^00/, "");
      if (!digits) return null;
      if (!/^\d{7,15}$/.test(digits)) {
        ctx.addIssue({ code: "custom", message: "whatsapp" });
        return z.NEVER;
      }
      return digits;
    }),
  phone: z
    .string()
    .max(30, "tooLong")
    .nullable()
    .transform((value, ctx) => {
      const v = (value ?? "").trim();
      if (!v) return null;
      if (!/^\+?[0-9][0-9\s()-]{4,24}$/.test(v)) {
        ctx.addIssue({ code: "custom", message: "phone" });
        return z.NEVER;
      }
      return v;
    }),
  email: z
    .string()
    .max(200, "tooLong")
    .nullable()
    .transform((value, ctx) => {
      const v = (value ?? "").trim();
      if (!v) return null;
      if (!z.email().safeParse(v).success) {
        ctx.addIssue({ code: "custom", message: "email" });
        return z.NEVER;
      }
      return v.toLowerCase();
    }),
  address: localizedSchema(240),
  mapsUrl: urlField,
  instagram: urlField,
  facebook: urlField,
  tiktok: urlField,
  website: urlField,
});
export type ContactInput = z.input<typeof contactSchema>;

export const dayHoursSchema = z.object({
  open: timeSchema,
  close: timeSchema,
  closed: z.boolean().optional(),
});

export const hoursSchema = z.partialRecord(z.enum(DAY_KEYS as [DayKey, ...DayKey[]]), dayHoursSchema);

/** Any IANA time zone the runtime knows (e.g. "Asia/Damascus"). */
export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  });
export type HoursInput = z.infer<typeof hoursSchema>;

export const currencySchema = z
  .object({
    currency: currencyCodeSchema,
    secondaryCurrency: currencyCodeSchema.nullable(),
    exchangeRate: z.number("rate").positive("rate").max(1_000_000_000, "rate").nullable(),
  })
  .refine((v) => !v.secondaryCurrency || v.secondaryCurrency !== v.currency, {
    error: "currencySame",
    path: ["secondaryCurrency"],
  })
  .refine((v) => !v.secondaryCurrency || (v.exchangeRate !== null && v.exchangeRate > 0), {
    error: "rate",
    path: ["exchangeRate"],
  })
  .transform((v) => (v.secondaryCurrency ? v : { ...v, exchangeRate: null }));
export type CurrencyInput = z.input<typeof currencySchema>;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** First issue message per field path ("name.ar", "options.0.price", ...), for inline form errors. */
export function issuesByPath(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
