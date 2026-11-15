"use client";

import Image from "next/image";
import { isOptimizableImage } from "@/lib/menu/image-url";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { toast } from "sonner";
import { ChevronDown, MapPin, Phone, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, pick } from "@/lib/i18n/config";
import { getOpenStatus } from "@/lib/menu/hours";
import type { Restaurant } from "@/lib/data/types";
import { useI18n, useMessages } from "@/components/providers/i18n-provider";
import { useMenu } from "./menu-context";
import { menuShareUrl, useNow } from "./hooks";
import { InstagramGlyph, WhatsappGlyph } from "./icons";
import { MenuImage } from "./menu-image";

/* ------------------------------------------------------------------ */

export async function shareLink(opts: { title: string; text: string; url: string; copied: string }) {
  try {
    if (navigator.share) {
      await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
      return;
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(opts.url);
    toast.success(opts.copied);
  } catch {
    window.prompt("", opts.url);
  }
}

export function OpenBadge({ className, onImage = false }: { className?: string; onImage?: boolean }) {
  const { restaurant } = useMenu();
  const t = useMessages("menu");
  const now = useNow();
  if (!now) return <span className={cn("inline-block h-8", className)} aria-hidden />;
  const status = getOpenStatus(restaurant.openingHours, now, restaurant.timezone);
  if (!status) return null;
  let detail = "";
  if (status.open) detail = status.closesAt ? fmt(t.hero.closesAt, { time: status.closesAt }) : t.hero.open24;
  else if (status.opensAt && status.today) detail = fmt(t.hero.opensAt, { time: status.opensAt });
  else if (status.opensAt && status.opensDay)
    detail = fmt(t.hero.opensOn, { day: t.footer.days[status.opensDay], time: status.opensAt });
  return (
    <motion.span
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      role="status"
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full px-3 text-[0.8rem] font-semibold",
        onImage ? "bg-black/35 text-white backdrop-blur-md" : "bg-(--m-surface-2) text-(--m-fg)",
        className,
      )}
    >
      <span
        className={cn("m-pulse-dot size-2 rounded-full", status.open ? "bg-emerald-500" : "bg-rose-500")}
        aria-hidden
      />
      <span>{status.open ? t.hero.openNow : t.hero.closedNow}</span>
      {detail && <span className="font-normal opacity-80">· {detail}</span>}
    </motion.span>
  );
}

interface QuickAction {
  key: string;
  label: string;
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
}

function useQuickActions(): QuickAction[] {
  const { restaurant } = useMenu();
  const { lang } = useI18n();
  const t = useMessages("menu").hero;
  const c = restaurant.contact;
  const name = pick(restaurant.name, lang);
  const list: QuickAction[] = [];
  const wa = c.whatsapp?.replace(/\D/g, "");
  if (wa) list.push({ key: "wa", label: t.whatsapp, href: `https://wa.me/${wa}`, icon: <WhatsappGlyph className="size-5" /> });
  if (c.phone) list.push({ key: "call", label: t.call, href: `tel:${c.phone.replace(/[^\d+]/g, "")}`, icon: <Phone className="size-5" aria-hidden /> });
  if (c.mapsUrl) list.push({ key: "map", label: t.map, href: c.mapsUrl, icon: <MapPin className="size-5" aria-hidden /> });
  if (c.instagram) list.push({ key: "ig", label: t.instagram, href: c.instagram, icon: <InstagramGlyph className="size-5" /> });
  list.push({
    key: "share",
    label: t.share,
    icon: <Share2 className="size-5" aria-hidden />,
    onClick: () => shareLink({ title: name, text: fmt(t.shareText, { name }), url: menuShareUrl(), copied: t.linkCopied }),
  });
  return list;
}

function ActionLink({ a, className, children }: { a: QuickAction; className: string; children: React.ReactNode }) {
  if (a.href) {
    const external = a.href.startsWith("http");
    return (
      <a
        href={a.href}
        className={className}
        aria-label={a.label}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={a.onClick} className={className} aria-label={a.label}>
      {children}
    </button>
  );
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } },
};
const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as const } },
};

/* ------------------------------------------------------------------ */

function Cover({ restaurant, className, overlay }: { restaurant: Restaurant; className?: string; overlay?: string }) {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, 150]);
  const { lang } = useI18n();
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <motion.div className="absolute inset-0" style={reduced ? undefined : { y }}>
        <div className="m-kenburns absolute inset-0">
          <MenuImage
            src={restaurant.coverUrl}
            blur={restaurant.coverBlur}
            alt={pick(restaurant.name, lang)}
            sizes="100vw"
            priority
            zoom={false}
            icon="utensils-crossed"
          />
        </div>
      </motion.div>
      {overlay && <div className={cn("absolute inset-0", overlay)} aria-hidden />}
    </div>
  );
}

function Logo({ restaurant, className, sizes = "112px" }: { restaurant: Restaurant; className?: string; sizes?: string }) {
  const { lang } = useI18n();
  const name = pick(restaurant.name, lang);
  return (
    <motion.div
      initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.12 }}
      className={cn("relative shrink-0 overflow-hidden", className)}
    >
      {restaurant.logoUrl ? (
        <Image src={restaurant.logoUrl} unoptimized={!isOptimizableImage(restaurant.logoUrl)} alt={name} fill sizes={sizes} className="object-cover" preload />
      ) : (
        <span className="grid size-full place-items-center bg-(--brand) text-3xl font-black text-(--brand-contrast)">
          {name.slice(0, 1)}
        </span>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

function AuroraHero() {
  const { restaurant } = useMenu();
  const { lang } = useI18n();
  const actions = useQuickActions();
  return (
    <section className="relative" aria-labelledby="menu-title">
      <div className="relative h-[44svh] min-h-[300px] max-h-[560px] overflow-hidden rounded-b-[2.25rem] md:rounded-b-[3rem]">
        <Cover restaurant={restaurant} overlay="bg-gradient-to-b from-black/35 via-transparent to-black/45" />
      </div>
      <div className="relative mx-auto -mt-28 max-w-2xl px-4 md:-mt-32">
        <div aria-hidden className="m-blob -top-8 start-2 size-44 bg-(--brand)" />
        <div aria-hidden className="m-blob -bottom-6 end-4 size-40 bg-(--brand-accent) [animation-delay:-6s]" />
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative flex flex-col items-center rounded-[2rem] border border-white/40 bg-(--m-surface)/85 px-5 pt-16 pb-6 text-center shadow-[var(--m-shadow-hover)] backdrop-blur-xl dark:border-white/10"
        >
          <Logo
            restaurant={restaurant}
            className="absolute -top-12 size-24 rounded-[1.75rem] border-4 border-(--m-surface) bg-(--m-surface) shadow-xl"
          />
          <motion.h1 variants={rise} id="menu-title" className="text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
            {pick(restaurant.name, lang)}
          </motion.h1>
          {pick(restaurant.tagline, lang) && (
            <motion.p variants={rise} className="mt-1.5 max-w-md text-[0.95rem] text-(--m-muted) text-pretty">
              {pick(restaurant.tagline, lang)}
            </motion.p>
          )}
          <motion.div variants={rise} className="mt-3">
            <OpenBadge />
          </motion.div>
          <motion.ul variants={rise} className="mt-5 flex flex-wrap justify-center gap-x-2.5 gap-y-3 sm:gap-x-4">
            {actions.map((a) => (
              <li key={a.key}>
                <ActionLink a={a} className="m-press m-focus group flex w-[3.25rem] flex-col items-center gap-1.5 rounded-2xl sm:w-16">
                  <span className="grid size-12 place-items-center rounded-full bg-(--brand) text-(--brand-contrast) shadow-[0_8px_20px_-8px_var(--brand)] transition-transform duration-300 group-hover:-translate-y-0.5">
                    {a.icon}
                  </span>
                  <span className="text-[0.72rem] font-medium text-(--m-muted)">{a.label}</span>
                </ActionLink>
              </li>
            ))}
          </motion.ul>
        </motion.div>
      </div>
    </section>
  );
}

function NoirHero() {
  const { restaurant } = useMenu();
  const { lang } = useI18n();
  const t = useMessages("menu").hero;
  const actions = useQuickActions();
  const other = pick(restaurant.name, lang === "ar" ? "en" : "ar");
  return (
    <section className="relative isolate h-[86svh] min-h-[520px] max-h-[900px] text-[#f3ece0]" aria-labelledby="menu-title">
      <Cover
        restaurant={restaurant}
        overlay="bg-[radial-gradient(120%_80%_at_50%_0%,transparent_30%,rgba(0,0,0,.55)_100%),linear-gradient(to_top,rgba(10,9,8,.96)_0%,rgba(0,0,0,.72)_32%,rgba(0,0,0,.15)_70%,rgba(0,0,0,.35)_100%)]"
      />
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-14 md:px-8 md:pb-20"
      >
        <motion.div variants={rise} className="flex items-center gap-4">
          <Logo restaurant={restaurant} className="size-16 rounded-full ring-1 ring-white/30 md:size-20" />
          <span className="h-px flex-1 bg-gradient-to-r from-[#f3ece0]/50 to-transparent rtl:bg-gradient-to-l" aria-hidden />
        </motion.div>
        {other && (
          <motion.p variants={rise} className="mt-6 text-xs font-medium tracking-[0.35em] uppercase opacity-70">
            {other}
          </motion.p>
        )}
        <motion.h1
          variants={rise}
          id="menu-title"
          className="mt-2 text-5xl leading-[1.05] font-semibold tracking-tight text-balance md:text-7xl lg:text-8xl"
        >
          {pick(restaurant.name, lang)}
        </motion.h1>
        {pick(restaurant.tagline, lang) && (
          <motion.p variants={rise} className="mt-4 max-w-xl text-base text-pretty opacity-80 md:text-lg">
            {pick(restaurant.tagline, lang)}
          </motion.p>
        )}
        <motion.div variants={rise} className="mt-5">
          <OpenBadge onImage />
        </motion.div>
        <motion.ul variants={rise} className="mt-6 flex flex-wrap gap-2">
          {actions.map((a) => (
            <li key={a.key}>
              <ActionLink
                a={a}
                className="m-press m-focus inline-flex h-11 items-center gap-2 rounded-full border border-[#f3ece0]/30 px-4 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-[#f3ece0] hover:text-[#0b0a09]"
              >
                {a.icon}
                <span>{a.label}</span>
              </ActionLink>
            </li>
          ))}
        </motion.ul>
      </motion.div>
      <a
        href="#menu"
        className="m-focus absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 rounded-full px-3 py-1 text-[0.7rem] tracking-[0.25em] text-[#f3ece0]/70 uppercase"
      >
        <span className="sr-only">{t.explore}</span>
        <motion.span
          aria-hidden
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="size-5" />
        </motion.span>
      </a>
    </section>
  );
}

function PopHero() {
  const { restaurant } = useMenu();
  const { lang } = useI18n();
  const actions = useQuickActions();
  return (
    <section className="relative" aria-labelledby="menu-title">
      <div className="m-zigzag relative h-[40svh] min-h-[280px] max-h-[520px] overflow-hidden bg-(--brand)">
        <Cover restaurant={restaurant} overlay="bg-gradient-to-b from-black/30 via-transparent to-transparent" />
      </div>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative mx-auto -mt-20 flex max-w-3xl flex-col items-center px-4 text-center"
      >
        <Logo
          restaurant={restaurant}
          className="size-24 rounded-full border-[3px] border-(--m-ink) bg-(--m-surface) shadow-[var(--m-shadow)] md:size-28"
        />
        <motion.h1
          variants={rise}
          id="menu-title"
          className="mt-4 -rotate-2 rounded-(--r-card) border-[3px] border-(--m-ink) bg-(--brand) px-5 py-2 text-4xl leading-tight font-black text-(--brand-contrast) shadow-[var(--m-shadow)] md:text-6xl"
        >
          {pick(restaurant.name, lang)}
        </motion.h1>
        {pick(restaurant.tagline, lang) && (
          <motion.p
            variants={rise}
            className="mt-4 rotate-1 rounded-full border-2 border-(--m-ink) bg-(--m-surface) px-4 py-1.5 text-sm font-bold"
          >
            {pick(restaurant.tagline, lang)}
          </motion.p>
        )}
        <motion.div variants={rise} className="mt-3">
          <OpenBadge className="border-2 border-(--m-ink)" />
        </motion.div>
        <motion.ul variants={rise} className="mt-5 flex flex-wrap justify-center gap-2.5">
          {actions.map((a, i) => (
            <li key={a.key}>
              <ActionLink
                a={a}
                className={cn(
                  "m-press m-focus inline-flex h-11 items-center gap-2 rounded-(--r-pill) border-2 border-(--m-ink) px-4 text-sm font-extrabold shadow-[var(--m-shadow)] transition-transform hover:-translate-y-0.5",
                  i % 2 === 0 ? "bg-(--brand-accent) text-(--brand-accent-contrast)" : "bg-(--m-surface) text-(--m-fg)",
                )}
              >
                {a.icon}
                <span>{a.label}</span>
              </ActionLink>
            </li>
          ))}
        </motion.ul>
      </motion.div>
    </section>
  );
}

export function MenuHero() {
  const { restaurant } = useMenu();
  switch (restaurant.theme.template) {
    case "noir":
      return <NoirHero />;
    case "pop":
      return <PopHero />;
    default:
      return <AuroraHero />;
  }
}
