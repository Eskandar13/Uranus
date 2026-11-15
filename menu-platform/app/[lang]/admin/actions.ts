"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ADMIN_ERROR_CODES,
  type ActionResult,
  type AdminErrorCode,
  type CreateRestaurantState,
  type NewRestaurantField,
  type OwnerOutcome,
  type SlugStatus,
  type UpdateRestaurantState,
} from "@/components/admin/types";
import { inviteOwner, requirePlatformAdmin, setActiveRestaurantId } from "@/lib/auth";
import { menuTagsFor, RESTAURANT_LIST_TAG } from "@/lib/cache-tags";
import { getRepository, RepositoryError } from "@/lib/data";
import { isReservedSlug, isValidSlug } from "@/lib/data/slug";
import {
  CURRENCIES,
  type Locale,
  type Restaurant,
  type RestaurantPatch,
  type RestaurantTheme,
  type TemplateId,
} from "@/lib/data/types";
import { getDataMode, publicMenuUrl, ROOT_DOMAIN } from "@/lib/env";

/**
 * Agency-admin server actions. Each one: requirePlatformAdmin() first, zod validation, then the
 * "service" repository (bypasses RLS in Supabase mode), then updateTag() for every affected
 * cache tag so public menus and the admin pages show the change immediately.
 */

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const langSchema = z.enum(["ar", "en"]).catch("ar");
const idSchema = z.guid();
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

async function admin(lang: unknown): Promise<Locale> {
  const l = langSchema.parse(lang);
  await requirePlatformAdmin(l);
  return l;
}

function toCode(err: unknown): AdminErrorCode {
  if (err instanceof RepositoryError) {
    if (err.code === "unknown") console.error("[admin]", err.message);
    return err.code;
  }
  console.error("[admin] unexpected error:", err);
  return "unknown";
}

function asAdminCode(code: string): AdminErrorCode {
  return (ADMIN_ERROR_CODES as readonly string[]).includes(code) ? (code as AdminErrorCode) : "unknown";
}

/** updateTag for every tag of every given restaurant version (old + new slug/domain). */
function revalidateRestaurants(...versions: Array<Pick<Restaurant, "id" | "slug" | "customDomain"> | null | undefined>) {
  const tags = new Set<string>([RESTAURANT_LIST_TAG]);
  for (const r of versions) if (r) for (const t of menuTagsFor(r)) tags.add(t);
  for (const t of tags) updateTag(t);
}

function slugProblem(slug: string): AdminErrorCode | null {
  if (!isValidSlug(slug)) return "slug_invalid";
  if (isReservedSlug(slug)) return "slug_reserved";
  return null;
}

const HOST_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** "https://Menu.Client.com/ar" -> "menu.client.com"; null when empty; "invalid" when not a hostname. */
function parseDomain(raw: string): string | null | "invalid" {
  let d = raw.trim().toLowerCase();
  if (!d) return null;
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  d = (d.split(/[/?#]/)[0] ?? "").replace(/:\d+$/, "").replace(/\.$/, "");
  if (!d || d.length > 253) return "invalid";
  const labels = d.split(".");
  if (labels.length < 2 || !labels.every((l) => HOST_LABEL.test(l))) return "invalid";
  if (!/^[a-z]{2,63}$/.test(labels[labels.length - 1]!) && !labels[labels.length - 1]!.startsWith("xn--")) return "invalid";
  if (d === "localhost" || d.endsWith(".localhost")) return "invalid";
  // A platform subdomain is not a custom domain.
  if (ROOT_DOMAIN && (d === ROOT_DOMAIN || d.endsWith(`.${ROOT_DOMAIN}`))) return "invalid";
  return d;
}

const TEMPLATE_THEMES: Record<TemplateId, Omit<RestaurantTheme, "template" | "primary">> = {
  aurora: { accent: "#0F766E", mode: "light", font: "cairo", radius: "round" },
  noir: { accent: "#D4A373", mode: "dark", font: "el-messiri", radius: "soft" },
  pop: { accent: "#F59E0B", mode: "light", font: "tajawal", radius: "round" },
};

const nameSchema = z.string().trim().max(80);
const slugInput = z.string().trim().toLowerCase().max(60);
const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/);

/* ------------------------------------------------------------------ */
/* Slug availability (live check in forms)                             */
/* ------------------------------------------------------------------ */

export async function checkSlugAction(lang: Locale, slug: string, exceptId?: string): Promise<SlugStatus> {
  await admin(lang);
  const s = slugInput.safeParse(slug);
  if (!s.success) return "invalid";
  const problem = slugProblem(s.data);
  if (problem) return problem === "slug_reserved" ? "reserved" : "invalid";
  const repo = await getRepository("service");
  if (exceptId && idSchema.safeParse(exceptId).success) {
    const current = await repo.getRestaurantById(exceptId);
    if (current?.slug === s.data) return "current";
  }
  return (await repo.isSlugAvailable(s.data)) ? "available" : "taken";
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

const createSchema = z.object({
  nameAr: nameSchema,
  nameEn: nameSchema,
  slug: slugInput,
  template: z.enum(["aurora", "noir", "pop"]),
  primary: hexColor,
  currency: z.string().refine((c) => CURRENCIES.some((x) => x.code === c)),
  ownerEmail: z.union([z.literal(""), z.email().max(254)]),
});

export async function createRestaurantAction(
  _prev: CreateRestaurantState,
  formData: FormData,
): Promise<CreateRestaurantState> {
  const lang = await admin(formData.get("lang"));
  const parsed = createSchema.safeParse({
    nameAr: str(formData.get("nameAr")),
    nameEn: str(formData.get("nameEn")),
    slug: str(formData.get("slug")),
    template: str(formData.get("template")),
    primary: str(formData.get("primary")),
    currency: str(formData.get("currency")) || "USD",
    ownerEmail: str(formData.get("ownerEmail")).trim().toLowerCase(),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0] as NewRestaurantField | undefined;
    return { error: field === "slug" ? "slug_invalid" : "invalid", field };
  }
  const v = parsed.data;
  if (!v.nameAr && !v.nameEn) return { error: "invalid", field: "nameAr" };
  const problem = slugProblem(v.slug);
  if (problem) return { error: problem, field: "slug" };

  let restaurant: Restaurant;
  try {
    const repo = await getRepository("service");
    restaurant = await repo.createRestaurant({
      slug: v.slug,
      name: { ar: v.nameAr, en: v.nameEn },
      tagline: { ar: "", en: "" },
      description: { ar: "", en: "" },
      theme: { template: v.template, primary: v.primary.toUpperCase(), ...TEMPLATE_THEMES[v.template] },
      currency: v.currency,
      secondaryCurrency: null,
      exchangeRate: null,
      contact: {
        whatsapp: null,
        phone: null,
        email: null,
        address: { ar: "", en: "" },
        mapsUrl: null,
        instagram: null,
        facebook: null,
        tiktok: null,
        website: null,
      },
      // No invented hours: an empty value keeps the open/closed badge hidden until the owner sets real ones.
      openingHours: {},
      isActive: true,
      plan: "trial",
    });
  } catch (err) {
    const code = toCode(err);
    return { error: code, field: code === "slug_taken" ? "slug" : undefined };
  }
  revalidateRestaurants(restaurant);

  let owner: OwnerOutcome | undefined;
  if (v.ownerEmail) {
    let res: Awaited<ReturnType<typeof inviteOwner>>;
    try {
      res = await inviteOwner({ email: v.ownerEmail, restaurantId: restaurant.id, lang });
    } catch (err) {
      res = { ok: false, error: toCode(err) } as typeof res;
    }
    if (res.ok) {
      owner = res.tempPassword
        ? { email: v.ownerEmail, status: "created", tempPassword: res.tempPassword }
        : { email: v.ownerEmail, status: getDataMode() === "local" ? "linked" : "invited" };
    } else {
      owner = { email: v.ownerEmail, status: "failed", error: asAdminCode(res.error) };
    }
  }

  return {
    ok: true,
    created: {
      id: restaurant.id,
      slug: restaurant.slug,
      nameAr: restaurant.name.ar,
      nameEn: restaurant.name.en,
      publicUrl: publicMenuUrl(restaurant.slug, lang, restaurant.customDomain),
    },
    owner,
  };
}

/* ------------------------------------------------------------------ */
/* Row actions                                                         */
/* ------------------------------------------------------------------ */

const duplicateSchema = z.object({
  sourceId: idSchema,
  slug: slugInput,
  nameAr: nameSchema,
  nameEn: nameSchema,
});

export async function duplicateRestaurantAction(input: {
  lang: Locale;
  sourceId: string;
  slug: string;
  nameAr: string;
  nameEn: string;
}): Promise<ActionResult<{ id: string; slug: string }>> {
  await admin(input?.lang);
  const parsed = duplicateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  if (!v.nameAr && !v.nameEn) return { ok: false, error: "invalid" };
  const problem = slugProblem(v.slug);
  if (problem) return { ok: false, error: problem };
  try {
    const repo = await getRepository("service");
    const copy = await repo.duplicateRestaurant(v.sourceId, { slug: v.slug, name: { ar: v.nameAr, en: v.nameEn } });
    revalidateRestaurants(copy);
    return { ok: true, id: copy.id, slug: copy.slug };
  } catch (err) {
    return { ok: false, error: toCode(err) };
  }
}

export async function setRestaurantActiveAction(input: {
  lang: Locale;
  id: string;
  active: boolean;
}): Promise<ActionResult> {
  await admin(input?.lang);
  const parsed = z.object({ id: idSchema, active: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const repo = await getRepository("service");
    const r = await repo.updateRestaurant(parsed.data.id, { isActive: parsed.data.active });
    revalidateRestaurants(r);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toCode(err) };
  }
}

export async function deleteRestaurantAction(input: {
  lang: Locale;
  id: string;
  confirm: string;
}): Promise<ActionResult> {
  await admin(input?.lang);
  const parsed = z.object({ id: idSchema, confirm: z.string().max(80) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const repo = await getRepository("service");
    const r = await repo.getRestaurantById(parsed.data.id);
    if (!r) return { ok: false, error: "not_found" };
    // The typed confirmation is checked on the server too.
    if (parsed.data.confirm.trim().toLowerCase() !== r.slug) return { ok: false, error: "confirm_mismatch" };
    await repo.deleteRestaurant(r.id);
    revalidateRestaurants(r);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toCode(err) };
  }
}

/** "Edit menu": make the restaurant active for this admin and open the owner dashboard. */
export async function editMenuAction(lang: Locale, id: string): Promise<ActionResult> {
  const l = await admin(lang);
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    await setActiveRestaurantId(parsed.data);
  } catch (err) {
    return { ok: false, error: toCode(err) };
  }
  redirect(`/${l}/dashboard`);
}

/* ------------------------------------------------------------------ */
/* Restaurant settings (plan, active, slug, custom domain)             */
/* ------------------------------------------------------------------ */

const updateSchema = z.object({
  id: idSchema,
  plan: z.enum(["trial", "basic", "pro"]),
  isActive: z.boolean(),
  slug: slugInput,
  customDomain: z.string().max(300),
});

export async function updateRestaurantAdminAction(
  _prev: UpdateRestaurantState,
  formData: FormData,
): Promise<UpdateRestaurantState> {
  await admin(formData.get("lang"));
  const nonce = Date.now();
  const parsed = updateSchema.safeParse({
    id: str(formData.get("id")),
    plan: str(formData.get("plan")),
    isActive: formData.get("isActive") === "on",
    slug: str(formData.get("slug")),
    customDomain: str(formData.get("customDomain")),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "slug" ? "slug_invalid" : "invalid", field: field === "plan" ? "plan" : undefined, nonce };
  }
  const v = parsed.data;
  const domain = parseDomain(v.customDomain);
  if (domain === "invalid") return { error: "domain_invalid", field: "customDomain", nonce };

  try {
    const repo = await getRepository("service");
    const old = await repo.getRestaurantById(v.id);
    if (!old) return { error: "not_found", nonce };

    const patch: RestaurantPatch = {};
    if (v.plan !== old.plan) patch.plan = v.plan;
    if (v.isActive !== old.isActive) patch.isActive = v.isActive;
    if (v.slug !== old.slug) {
      const problem = slugProblem(v.slug);
      if (problem) return { error: problem, field: "slug", nonce };
      patch.slug = v.slug;
    }
    if (domain !== (old.customDomain ?? null)) patch.customDomain = domain;
    if (Object.keys(patch).length === 0) return { ok: true, nonce };

    const updated = await repo.updateRestaurant(v.id, patch);
    revalidateRestaurants(old, updated);
    return { ok: true, nonce };
  } catch (err) {
    const code = toCode(err);
    return {
      error: code,
      field: code === "slug_taken" ? "slug" : code === "domain_taken" ? "customDomain" : undefined,
      nonce,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Members                                                             */
/* ------------------------------------------------------------------ */

export async function inviteOwnerAction(input: {
  lang: Locale;
  restaurantId: string;
  email: string;
}): Promise<ActionResult<{ owner: OwnerOutcome }>> {
  const lang = await admin(input?.lang);
  const parsed = z
    .object({ restaurantId: idSchema, email: z.email().max(254) })
    .safeParse({ restaurantId: input?.restaurantId, email: String(input?.email ?? "").trim().toLowerCase() });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { restaurantId, email } = parsed.data;

  let res: Awaited<ReturnType<typeof inviteOwner>>;
  try {
    const repo = await getRepository("service");
    const r = await repo.getRestaurantById(restaurantId);
    if (!r) return { ok: false, error: "not_found" };
    res = await inviteOwner({ email, restaurantId, lang });
  } catch (err) {
    return { ok: false, error: toCode(err) };
  }
  if (!res.ok) return { ok: false, error: asAdminCode(res.error) };
  updateTag(RESTAURANT_LIST_TAG);
  refresh();
  return {
    ok: true,
    owner: res.tempPassword
      ? { email, status: "created", tempPassword: res.tempPassword }
      : { email, status: getDataMode() === "local" ? "linked" : "invited" },
  };
}

export async function removeMemberAction(input: {
  lang: Locale;
  restaurantId: string;
  userId: string;
}): Promise<ActionResult> {
  await admin(input?.lang);
  const parsed = z.object({ restaurantId: idSchema, userId: z.string().min(1).max(128) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const repo = await getRepository("service");
    await repo.removeMember(parsed.data.restaurantId, parsed.data.userId);
    updateTag(RESTAURANT_LIST_TAG);
    refresh();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toCode(err) };
  }
}
