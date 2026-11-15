"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Category, CurrencyCode, MenuItem, PublicMenu, Restaurant } from "@/lib/data/types";
import { hasSecondaryCurrency } from "@/lib/format/price";
import { setItemParam, useItemParam, useStoredChoice, useStoredString, writeStored } from "./hooks";

export type ViewMode = "grid" | "list";
const VIEWS: readonly ViewMode[] = ["grid", "list"];

type CategoryWithItems = Category & { items: MenuItem[] };

interface MenuValue {
  menu: PublicMenu;
  restaurant: Restaurant;
  categories: CategoryWithItems[];
  itemBySlug: Map<string, MenuItem>;
  categoryById: Map<string, CategoryWithItems>;
  /** Currency prices are displayed in. */
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  /** Slug of the item shown in the sheet (from ?item=). */
  openSlug: string | null;
  /** Where the sheet was opened from: "grid" enables the shared image animation. */
  openItem: (slug: string, origin?: "grid" | "other") => void;
  closeItem: () => void;
  openOrigin: "grid" | "other";
  recentSlugs: string[];
}

const MenuContext = createContext<MenuValue | null>(null);

export function useMenu(): MenuValue {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("useMenu must be used inside <MenuProvider>");
  return ctx;
}

export function MenuProvider({ menu, children }: { menu: PublicMenu; children: ReactNode }) {
  const { restaurant, categories } = menu;
  const [openOrigin, setOpenOrigin] = useState<"grid" | "other">("other");

  const currencies = useMemo(() => {
    const list = [restaurant.currency];
    if (hasSecondaryCurrency(restaurant) && restaurant.secondaryCurrency) list.push(restaurant.secondaryCurrency);
    return list;
  }, [restaurant]);

  const [currency, setCurrency] = useStoredChoice(`menu-currency:${restaurant.slug}`, restaurant.currency, currencies);
  const defaultView: ViewMode = restaurant.theme.template === "noir" ? "list" : "grid";
  const [view, setView] = useStoredChoice("menu-view", defaultView, VIEWS);

  const itemBySlug = useMemo(() => {
    const m = new Map<string, MenuItem>();
    for (const c of categories) for (const i of c.items) m.set(i.slug, i);
    return m;
  }, [categories]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const param = useItemParam();
  const openSlug = param && itemBySlug.has(param) ? param : null;

  const recentKey = `menu-recent:${restaurant.slug}`;
  const recentRaw = useStoredString(recentKey);
  const recentSlugs = useMemo(() => {
    try {
      const parsed: unknown = recentRaw ? JSON.parse(recentRaw) : [];
      return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string" && itemBySlug.has(s)) : [];
    } catch {
      return [];
    }
  }, [recentRaw, itemBySlug]);

  const openItem = useCallback(
    (slug: string, origin: "grid" | "other" = "other") => {
      setOpenOrigin(origin);
      setItemParam(slug);
      let current: string[] = [];
      try {
        const raw = window.localStorage.getItem(recentKey);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) current = parsed.filter((s): s is string => typeof s === "string");
      } catch {
        /* ignore */
      }
      writeStored(recentKey, JSON.stringify([slug, ...current.filter((s) => s !== slug)].slice(0, 8)));
    },
    [recentKey],
  );
  const closeItem = useCallback(() => setItemParam(null), []);

  const value: MenuValue = {
    menu,
    restaurant,
    categories,
    itemBySlug,
    categoryById,
    currency,
    setCurrency,
    view,
    setView,
    openSlug,
    openItem,
    closeItem,
    openOrigin,
    recentSlugs,
  };
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}
