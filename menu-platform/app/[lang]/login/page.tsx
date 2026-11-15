import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCardSkeleton } from "@/components/auth/auth-skeleton";
import { LoginForm } from "@/components/auth/login-form";
import type { DemoAccount } from "@/components/auth/types";
import { getCurrentUser } from "@/lib/auth";
import { demoLoginAllowed } from "@/lib/auth/demo";
import { postLoginPath, safeNextPath } from "@/lib/auth/redirects";
import { getDataMode } from "@/lib/env";
import { isLocale } from "@/lib/i18n/config";

/**
 * /[lang]/login. The session check (already signed in -> redirect) and the query string are
 * request-time data, so they sit behind <Suspense> with a form-shaped skeleton.
 */
export default function LoginPage({ params, searchParams }: PageProps<"/[lang]/login">) {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <LoginGate params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginGate({
  params,
  searchParams,
}: {
  params: PageProps<"/[lang]/login">["params"];
  searchParams: PageProps<"/[lang]/login">["searchParams"];
}) {
  const [{ lang: raw }, sp] = await Promise.all([params, searchParams]);
  const lang = isLocale(raw) ? raw : "ar";
  const next = typeof sp.next === "string" ? sp.next : undefined;

  const user = await getCurrentUser();
  if (user) redirect(postLoginPath(next, user, lang));

  return (
    <LoginForm
      lang={lang}
      next={safeNextPath(next) ?? ""}
      linkError={sp.error === "link"}
      demoAccounts={getDataMode() === "local" && demoLoginAllowed() ? await loadDemoAccounts() : []}
    />
  );
}

/** Seed demo logins still using their published demo password (local mode only). */
async function loadDemoAccounts(): Promise<DemoAccount[]> {
  const [{ readDb }, { isHashedPassword }] = await Promise.all([
    import("@/lib/data/local/store"),
    import("@/lib/auth/crypto"),
  ]);
  const db = await readDb();
  return db.users
    .filter((u) => u.password && !isHashedPassword(u.password))
    .map((u) => ({
      email: u.email,
      password: u.password,
      displayName: u.displayName || u.email,
      kind: db.platformAdminIds.includes(u.id) ? ("admin" as const) : ("owner" as const),
    }))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "admin" ? -1 : 1));
}
