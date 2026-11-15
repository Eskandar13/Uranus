"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type {
  ResetFormState,
  SignInFormState,
  UpdatePasswordError,
  UpdatePasswordFormState,
} from "@/components/auth/types";
import { isLocale } from "@/lib/i18n/config";
import type { Locale } from "@/lib/data/types";
import { getCurrentUser, sendPasswordReset, setActiveRestaurantId, signIn, signOut, updatePassword } from "./index";
import { homeFor, postLoginPath } from "./redirects";

/**
 * Auth server actions. Every action validates its input with zod and derives identity from the
 * session cookie, never from form fields.
 *
 *  - signInAction             login form (useActionState)
 *  - signOutAction(lang)      sign-out button: <form action={signOutAction.bind(null, lang)}>
 *  - requestPasswordResetAction, updatePasswordAction   forgot / set-new-password forms
 *  - switchRestaurantAction(lang, restaurantId)         dashboard restaurant switcher
 */

const langOf = (value: unknown): Locale => (isLocale(value) ? value : "ar");
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : undefined);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const signInSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
  next: z.string().max(512).optional(),
  lang: z.enum(["ar", "en"]),
});

export async function signInAction(_prev: SignInFormState, formData: FormData): Promise<SignInFormState> {
  const email = (str(formData.get("email")) ?? "").trim();
  const parsed = signInSchema.safeParse({
    email,
    password: str(formData.get("password")),
    next: str(formData.get("next")) || undefined,
    lang: str(formData.get("lang")),
  });
  if (!parsed.success) return { error: "invalid", email };

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    // Small fixed delay on failures slows down password guessing.
    await pause(350);
    return { error: result.error, email };
  }
  redirect(postLoginPath(parsed.data.next, result.user, parsed.data.lang));
}

export async function signOutAction(lang: Locale | string): Promise<void> {
  const l = langOf(lang);
  await signOut();
  redirect(`/${l}/login`);
}

const resetSchema = z.object({ email: z.email().max(254), lang: z.enum(["ar", "en"]) });

export async function requestPasswordResetAction(_prev: ResetFormState, formData: FormData): Promise<ResetFormState> {
  const email = (str(formData.get("email")) ?? "").trim();
  const parsed = resetSchema.safeParse({ email, lang: str(formData.get("lang")) });
  if (!parsed.success) return { status: "error", error: "invalid", email };
  const res = await sendPasswordReset(parsed.data.email, parsed.data.lang);
  return res.ok ? { status: "sent", email } : { status: "error", error: "unknown", email };
}

const passwordSchema = z.object({
  password: z.string().min(8).max(128),
  confirm: z.string().max(128),
  lang: z.enum(["ar", "en"]),
});

export async function updatePasswordAction(
  _prev: UpdatePasswordFormState,
  formData: FormData,
): Promise<UpdatePasswordFormState> {
  const parsed = passwordSchema.safeParse({
    password: str(formData.get("password")) ?? "",
    confirm: str(formData.get("confirm")) ?? "",
    lang: str(formData.get("lang")),
  });
  if (!parsed.success) return { error: "too_short" };
  if (parsed.data.password !== parsed.data.confirm) return { error: "mismatch" };

  const res = await updatePassword(parsed.data.password);
  if (!res.ok) {
    const known: UpdatePasswordError[] = ["no_session", "same_password", "weak_password", "read_only", "rate_limited"];
    return { error: (known as string[]).includes(res.error) ? (res.error as UpdatePasswordError) : "unknown" };
  }
  const user = await getCurrentUser();
  return { ok: true, redirectTo: user ? homeFor(user, parsed.data.lang) : `/${parsed.data.lang}/login` };
}

export async function switchRestaurantAction(lang: Locale | string, restaurantId: string): Promise<void> {
  const l = langOf(lang);
  const id = z.guid().safeParse(restaurantId);
  if (id.success) {
    try {
      await setActiveRestaurantId(id.data);
    } catch {
      // Not allowed or unknown: fall through to the dashboard, which shows the default restaurant.
    }
  }
  redirect(`/${l}/dashboard`);
}
