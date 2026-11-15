"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import type { PublicMenu } from "@/lib/data/types";
import { EMPTY_FILTERS, isFiltering, type FilterState } from "@/lib/menu/filters";
import { useI18n, useMessages } from "@/components/providers/i18n-provider";
import { MenuProvider, useMenu } from "./menu-context";
import { MenuHeader } from "./header";
import { MenuHero } from "./hero";
import {
  CategoryPills,
  CategoryShowcase,
  CategorySidebar,
  FilterBar,
  MenuSections,
  sectionId,
  useFilteredMenu,
  useScrollSpy,
} from "./menu-sections";
import { FeaturedCarousel, MenuFooter, SearchOverlay } from "./menu-extras";
import { ItemDetails, ItemSheet } from "./item-sheet";
import { APP_URL } from "@/lib/env";
import { itemPathFromLocation, menuPathFromLocation, useMounted } from "./hooks";

/** The guest-facing menu page (client part). Data comes prerendered from the cached query. */
export function MenuApp({ menu }: { menu: PublicMenu }) {
  return (
    <MenuProvider menu={menu}>
      <MenuBody />
    </MenuProvider>
  );
}

function MenuBody() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const { view } = useMenu();
  const { visible, keys, count } = useFilteredMenu(filters);
  const filtering = isFiltering(filters);
  const hasMenu = visible.length > 0 || filtering;
  const { active, scrollTo } = useScrollSpy(visible.map(sectionId));

  return (
    <>
      <MenuHeader onSearch={() => setSearchOpen(true)} />
      <MenuHero />
      <CategoryShowcase onSelect={scrollTo} />
      <FeaturedCarousel />
      <main
        id="menu"
        tabIndex={-1}
        className="mx-auto mt-10 max-w-7xl outline-none md:mt-14 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 lg:px-8 xl:grid-cols-[16.5rem_minmax(0,1fr)]"
      >
        <aside className="hidden lg:block">
          <CategorySidebar categories={visible} active={active} onSelect={scrollTo} />
        </aside>
        <div className="min-w-0">
          {hasMenu && <CategoryPills categories={visible} active={active} onSelect={scrollTo} />}
          <div className="px-4 md:px-8 lg:px-0">
            {hasMenu && <FilterBar filters={filters} setFilters={setFilters} keys={keys} count={count} />}
            <MenuSections
              visible={visible}
              view={view}
              filtering={filtering}
              active={active}
              onSelect={scrollTo}
              onClear={() => setFilters(EMPTY_FILTERS)}
            />
          </div>
        </div>
      </main>
      <MenuFooter />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ItemSheet />
    </>
  );
}

/** Shareable item page (SEO): same look as the menu, with "back to menu" and similar items. */
export function ItemPageView({ menu, itemSlug }: { menu: PublicMenu; itemSlug: string }) {
  return (
    <MenuProvider menu={menu}>
      <ItemPageBody itemSlug={itemSlug} />
    </MenuProvider>
  );
}

function ItemPageBody({ itemSlug }: { itemSlug: string }) {
  const { itemBySlug, restaurant } = useMenu();
  const { lang } = useI18n();
  const t = useMessages("menu").item;
  const [searchOpen, setSearchOpen] = useState(false);
  const mounted = useMounted();
  const item = itemBySlug.get(itemSlug);
  if (!item) return null;
  // Absolute platform URL: valid on every host (a relative /<lang>/r/<slug> 404s on tenant hosts before hydration).
  const fallbackMenu = `${APP_URL}/${lang}/r/${restaurant.slug}`;
  const backHref = mounted ? menuPathFromLocation() : fallbackMenu;
  const similarHref = (s: { slug: string }) =>
    mounted ? itemPathFromLocation(s.slug) : `${fallbackMenu}/item/${encodeURIComponent(s.slug)}`;

  return (
    <>
      <MenuHeader onSearch={() => setSearchOpen(true)} overHero={false} />
      <main id="menu" className="mx-auto max-w-5xl px-4 pt-[calc(var(--menu-header-h)+1rem)] pb-12 md:px-8">
        <motion.a
          href={backHref}
          initial={{ opacity: 0, x: lang === "ar" ? 8 : -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="m-press m-focus mb-4 inline-flex h-11 items-center gap-2 rounded-full border border-(--m-line) bg-(--m-surface) px-4 text-sm font-semibold"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t.backToMenu}
        </motion.a>
        <motion.article
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="m-sheet overflow-hidden rounded-[calc(var(--r-card)+0.25rem)] border border-(--m-line) p-4 md:p-0"
        >
          <ItemDetails
            item={item}
            wide
            similarHref={similarHref}
            imageSizes="(min-width:1024px) 520px, (min-width:768px) 50vw, 100vw"
            titleSlot={(name) => <h1 className="mt-0.5 text-3xl leading-tight font-extrabold text-balance md:text-4xl">{name}</h1>}
          />
        </motion.article>
      </main>
      <MenuFooter />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ItemSheet />
    </>
  );
}

/** Friendly not-found screen for unknown/inactive restaurants and dishes. */
export function MenuNotFoundView() {
  const t = useMessages("menu").notFound;
  const { lang } = useI18n();
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 py-16 text-center text-foreground">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-md">
        <svg viewBox="0 0 220 160" className="mx-auto h-40 w-auto" aria-hidden>
          <ellipse cx="110" cy="140" rx="80" ry="9" fill="currentColor" opacity=".07" />
          <path d="M40 112h140a70 70 0 0 0-140 0Z" fill="currentColor" opacity=".08" />
          <path d="M40 112h140" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".5" />
          <circle cx="110" cy="40" r="8" fill="currentColor" opacity=".5" />
          <path d="M78 84c6-8 14-8 20 0M122 84c6-8 14-8 20 0" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity=".55" />
          <path d="M96 100c8 6 20 6 28 0" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity=".55" transform="rotate(180 110 100)" />
        </svg>
        <h1 className="mt-6 text-2xl font-extrabold text-balance">{t.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
        <a
          href={`/${lang}`}
          className="mt-6 inline-flex h-11 items-center rounded-full bg-foreground px-6 text-sm font-bold text-background transition-transform active:scale-95"
        >
          {t.home}
        </a>
      </motion.div>
    </main>
  );
}
