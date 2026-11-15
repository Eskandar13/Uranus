import { NextResponse, type NextRequest } from "next/server";
import { completeEmailLink } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth/redirects";
import { getDataMode } from "@/lib/env";
import { isLocale } from "@/lib/i18n/config";

/**
 * GET /[lang]/auth/callback — landing point of Supabase auth emails (invite, password recovery).
 * Exchanges `?code=` (PKCE) or `?token_hash=&type=` (email OTP) for a session cookie, then
 * redirects to `?next=` — only a same-site relative path is accepted (no open redirects).
 * Implicit-flow links carry the session in the URL fragment, which browsers keep across this
 * redirect; /auth/update-password picks it up on the client.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/[lang]/auth/callback">) {
  const { lang: raw } = await ctx.params;
  const lang = isLocale(raw) ? raw : "ar";
  const q = request.nextUrl.searchParams;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), { status: 303 });
  const loginWithError = `/${lang}/login?error=link`;

  if (getDataMode() === "local") return to(`/${lang}/login`);
  if (q.get("error") || q.get("error_code")) return to(loginWithError);

  const type = q.get("type");
  const fallback =
    type === "recovery" || type === "invite" ? `/${lang}/auth/update-password` : `/${lang}/dashboard`;
  const next = safeNextPath(q.get("next")) ?? fallback;

  const code = q.get("code");
  const tokenHash = q.get("token_hash");
  if (!code && !tokenHash) return to(next);

  const ok = await completeEmailLink({ code, tokenHash, type });
  return to(ok ? next : loginWithError);
}
