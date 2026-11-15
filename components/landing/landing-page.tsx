import Link from "next/link";
import {
  ArrowRight,
  Check,
  Globe,
  ImageIcon,
  Languages,
  MessageCircle,
  Moon,
  Plus,
  QrCode,
  ScanLine,
  Smartphone,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/dictionaries";
import { PhoneMockup } from "./phone-mockup";
import { Reveal } from "./reveal";
import { SiteHeader } from "./site-header";
import { LogoMark } from "./logo-mark";
import "./landing.css";

/**
 * Agency WhatsApp number from NEXT_PUBLIC_AGENCY_WHATSAPP, international format with country code
 * ("963912345678"; "+" and spaces are tolerated). Empty when not configured.
 */
const AGENCY_WHATSAPP = (process.env.NEXT_PUBLIC_AGENCY_WHATSAPP ?? "").replace(/\D/g, "").replace(/^0+/, "");

/** wa.me link with a prefilled message, or null when no number is set (the WhatsApp buttons are then hidden). */
function whatsappUrl(text: string): string | null {
  return AGENCY_WHATSAPP ? `https://wa.me/${AGENCY_WHATSAPP}?text=${encodeURIComponent(text)}` : null;
}

const FEATURE_ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  image: ImageIcon,
  languages: Languages,
  moon: Moon,
  qr: QrCode,
  smartphone: Smartphone,
  globe: Globe,
  scan: ScanLine,
};

const DEMO_THEMES: Record<string, { bg: string; fg: string; art: React.ReactNode }> = {
  "demo-cafe": {
    bg: "#3b2517",
    fg: "#f6e6cf",
    art: (
      <svg viewBox="0 0 300 320" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        <circle cx="240" cy="70" r="90" fill="#7a4a2a" opacity=".7" />
        <circle cx="240" cy="70" r="55" fill="#c98b4e" opacity=".6" />
        <circle cx="240" cy="70" r="26" fill="#f6e6cf" opacity=".85" />
        <path d="M0 250 Q80 200 160 250 T320 240 V320 H0Z" fill="#2a190e" opacity=".6" />
      </svg>
    ),
  },
  "demo-bistro": {
    bg: "#5a1f2b",
    fg: "#f3dfb5",
    art: (
      <svg viewBox="0 0 300 320" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        <g fill="none" stroke="#d9b36a" strokeWidth="1.5" opacity=".6">
          <circle cx="230" cy="80" r="30" />
          <circle cx="230" cy="80" r="52" />
          <circle cx="230" cy="80" r="76" />
          <circle cx="230" cy="80" r="102" />
        </g>
        <circle cx="230" cy="80" r="12" fill="#d9b36a" />
      </svg>
    ),
  },
  "demo-burger": {
    bg: "#f1ad2f",
    fg: "#2b1608",
    art: (
      <svg viewBox="0 0 300 320" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        <rect x="190" y="30" width="170" height="40" rx="20" fill="#e2512b" transform="rotate(-18 190 30)" />
        <rect x="170" y="90" width="170" height="26" rx="13" fill="#2b1608" transform="rotate(-18 170 90)" opacity=".85" />
        <rect x="150" y="136" width="170" height="40" rx="20" fill="#fff3d6" transform="rotate(-18 150 136)" />
        <circle cx="40" cy="300" r="60" fill="#e2512b" opacity=".35" />
      </svg>
    ),
  },
};

export function LandingPage({
  lang,
  m,
  name,
}: {
  lang: Locale;
  m: Messages<"landing">;
  name: string;
}) {
  const wa = whatsappUrl(m.contact.whatsappText);
  return (
    <div className="lp">
      <SiteHeader lang={lang} name={name} nav={m.nav} />

      <main>
        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-blob lp-blob-a" aria-hidden="true" />
          <div className="lp-blob lp-blob-b" aria-hidden="true" />
          <div className="lp-wrap lp-hero-grid" style={{ position: "relative", zIndex: 1 }}>
            <div>
              <Reveal>
                <span className="lp-eyebrow">{m.hero.eyebrow}</span>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="lp-display">
                  {m.hero.titleStart} <span className="lp-accent-text">{m.hero.titleAccent}</span>
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="lp-sub">{m.hero.subtitle}</p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="lp-cta-row">
                  <a href="#demos" className="lp-btn lp-btn-primary">
                    {m.hero.ctaDemos}
                    <ArrowRight size={18} className="rtl:-scale-x-100" aria-hidden="true" />
                  </a>
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-wa">
                      <MessageCircle size={18} aria-hidden="true" />
                      {m.hero.ctaWhatsapp}
                    </a>
                  )}
                </div>
              </Reveal>
              <Reveal delay={0.2}>
                <ul className="lp-points">
                  {m.hero.points.map((p) => (
                    <li key={p}>
                      <Check size={16} aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              <PhoneMockup m={m.mock} />
            </Reveal>
          </div>
        </section>

        {/* Live demos */}
        <section id="demos" className="lp-section" style={{ scrollMarginTop: "4rem" }}>
          <div className="lp-wrap">
            <Reveal>
              <span className="lp-eyebrow">{m.demos.eyebrow}</span>
              <h2 className="lp-display lp-h2">{m.demos.title}</h2>
              <p className="lp-lead">{m.demos.subtitle}</p>
            </Reveal>
            <div className="lp-demos">
              {m.demos.items.map((d, i) => {
                const t = DEMO_THEMES[d.slug];
                return (
                  <Reveal key={d.slug} delay={i * 0.08}>
                    <Link
                      href={`/${lang}/r/${d.slug}`}
                      className="lp-demo"
                      style={{ "--demo-bg": t.bg, "--demo-fg": t.fg } as React.CSSProperties}
                    >
                      <div className="lp-demo-art" aria-hidden="true">
                        {t.art}
                      </div>
                      <span className="lp-demo-tag">{d.tag}</span>
                      <h3 className="lp-display">{d.name}</h3>
                      <p>{d.desc}</p>
                      <span className="lp-demo-open">
                        {m.demos.open}
                        <ArrowRight size={18} className="rtl:-scale-x-100" aria-hidden="true" />
                      </span>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="lp-section lp-features" style={{ scrollMarginTop: "4rem" }}>
          <div className="lp-wrap">
            <Reveal>
              <span className="lp-eyebrow">{m.features.eyebrow}</span>
              <h2 className="lp-display lp-h2">{m.features.title}</h2>
              <p className="lp-lead">{m.features.subtitle}</p>
            </Reveal>
            <div className="lp-feat-grid">
              {m.features.items.map((f, i) => {
                const Icon = FEATURE_ICONS[f.icon] ?? Zap;
                return (
                  <Reveal key={f.title} delay={(i % 4) * 0.06} className="lp-feat">
                    <span className="lp-feat-icon">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <h3>{f.title}</h3>
                    <p>{f.desc}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="lp-section" style={{ scrollMarginTop: "4rem" }}>
          <div className="lp-wrap">
            <Reveal>
              <span className="lp-eyebrow">{m.how.eyebrow}</span>
              <h2 className="lp-display lp-h2">{m.how.title}</h2>
            </Reveal>
            <ol className="lp-steps">
              {m.how.steps.map((s, i) => (
                <Reveal key={s.title} as="li" delay={i * 0.1} className="lp-step">
                  <span className="lp-step-num lp-display" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3 className="lp-display">{s.title}</h3>
                  <p>{s.desc}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing teaser */}
        <section id="pricing" className="lp-section" style={{ paddingBlockStart: 0, scrollMarginTop: "4rem" }}>
          <div className="lp-wrap">
            <Reveal className="lp-price-card">
              <div>
                <span className="lp-eyebrow">{m.pricing.eyebrow}</span>
                <h2 className="lp-display">{m.pricing.title}</h2>
                <p style={{ opacity: 0.85, maxWidth: "32rem", margin: 0 }}>{m.pricing.subtitle}</p>
              </div>
              <div>
                <h3 className="lp-display" style={{ fontSize: "1.4rem", margin: "0 0 0.25rem" }}>
                  {m.pricing.cardTitle}
                </h3>
                <p style={{ margin: "0 0 1rem", opacity: 0.8, fontSize: "0.95rem" }}>{m.pricing.cardNote}</p>
                <ul className="lp-price-list">
                  {m.pricing.includes.map((x) => (
                    <li key={x}>
                      <Check size={18} aria-hidden="true" />
                      {x}
                    </li>
                  ))}
                </ul>
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-light">
                    <MessageCircle size={18} aria-hidden="true" />
                    {m.pricing.cta}
                  </a>
                )}
              </div>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="lp-section" style={{ paddingBlockStart: 0, scrollMarginTop: "4rem" }}>
          <div className="lp-wrap">
            <Reveal>
              <span className="lp-eyebrow">{m.faq.eyebrow}</span>
              <h2 className="lp-display lp-h2">{m.faq.title}</h2>
            </Reveal>
            <div className="lp-faq-list">
              {m.faq.items.map((f, i) => (
                <Reveal key={f.q} delay={Math.min(i, 3) * 0.05}>
                  <details className="lp-faq">
                    <summary>
                      {f.q}
                      <Plus size={20} aria-hidden="true" />
                    </summary>
                    <p className="lp-faq-a">{f.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="lp-final">
          <div className="lp-wrap">
            <Reveal>
              <h2 className="lp-display">{m.cta.title}</h2>
              <p className="lp-lead" style={{ marginInline: "auto" }}>
                {m.cta.subtitle}
              </p>
              <div className="lp-cta-row">
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-wa">
                    <MessageCircle size={18} aria-hidden="true" />
                    {m.cta.whatsapp}
                  </a>
                )}
                <a href="#demos" className="lp-btn lp-btn-ghost">
                  {m.cta.demos}
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-row">
          <div>
            <span className="lp-logo lp-display" style={{ color: "var(--lp-ink)" }}>
              <LogoMark size={28} />
              {name}
            </span>
            <p style={{ margin: "0.25rem 0 0" }}>{m.footer.tagline}</p>
          </div>
          <nav className="lp-footer-links" aria-label={name}>
            <a href="#demos">{m.nav.demos}</a>
            <a href="#features">{m.nav.features}</a>
            <a href="#faq">{m.nav.faq}</a>
            <Link href={`/${lang}/login`}>{m.footer.login}</Link>
          </nav>
          <p style={{ margin: 0, width: "100%" }}>
            © {name}. {m.footer.rights}
          </p>
        </div>
      </footer>
    </div>
  );
}
