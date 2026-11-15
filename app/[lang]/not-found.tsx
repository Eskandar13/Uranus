import Link from "next/link";
import { LogoMark } from "@/components/landing/logo-mark";
import { getDictionary } from "@/lib/i18n/dictionaries";
import "@/components/landing/landing.css";

/**
 * not-found cannot read route params, so it shows both languages side by side.
 * It is rendered inside the root layout, so <html lang dir> is already set.
 */
export default async function NotFound() {
  const [ar, en] = await Promise.all([getDictionary("ar", "landing"), getDictionary("en", "landing")]);
  return (
    <div className="lp">
      <main className="lp-404">
        <div className="lp-404-card">
          <LogoMark size={44} />
          <div className="lp-404-code lp-display" aria-hidden="true">
            404
          </div>
          <div className="lp-404-pair">
            <div lang="ar" dir="rtl">
              <h1 className="lp-display">{ar.notFound.title}</h1>
              <p>{ar.notFound.text}</p>
              <Link href="/ar" className="lp-btn lp-btn-primary lp-btn-sm">
                {ar.notFound.home}
              </Link>
            </div>
            <div lang="en" dir="ltr">
              <h1 className="lp-display">{en.notFound.title}</h1>
              <p>{en.notFound.text}</p>
              <Link href="/en" className="lp-btn lp-btn-primary lp-btn-sm">
                {en.notFound.home}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
