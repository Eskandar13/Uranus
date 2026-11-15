import type { Category, MenuItem } from "@/lib/data/types";

export type FilterKey = "offers" | "new" | "popular" | "spicy" | "vegetarian";
export const FILTER_KEYS: FilterKey[] = ["offers", "new", "popular", "spicy", "vegetarian"];
export type SortKey = "recommended" | "price-asc" | "price-desc";
export const SORT_KEYS: SortKey[] = ["recommended", "price-asc", "price-desc"];

export interface FilterState {
  active: FilterKey[];
  sort: SortKey;
  availableOnly: boolean;
}

export const EMPTY_FILTERS: FilterState = { active: [], sort: "recommended", availableOnly: false };

export function isOnOffer(item: MenuItem): boolean {
  return item.oldPrice != null && item.oldPrice > item.price;
}

/** The lowest price shown on a card ("from" price when options exist). */
export function basePrice(item: MenuItem): number {
  if (item.options.length === 0) return item.price;
  return Math.min(...item.options.map((o) => o.price));
}

export function matchesFilter(item: MenuItem, key: FilterKey): boolean {
  switch (key) {
    case "offers":
      return isOnOffer(item);
    case "new":
      return item.tags.includes("new");
    case "popular":
      return item.tags.includes("popular") || item.tags.includes("chef_pick");
    case "spicy":
      return item.tags.includes("spicy");
    case "vegetarian":
      return item.tags.includes("vegetarian") || item.tags.includes("vegan");
  }
}

/** Filter chips worth showing (at least one item matches). */
export function availableFilters(categories: Array<{ items: MenuItem[] }>): FilterKey[] {
  return FILTER_KEYS.filter((k) => categories.some((c) => c.items.some((i) => matchesFilter(i, k))));
}

export function isFiltering(f: FilterState): boolean {
  return f.active.length > 0 || f.availableOnly || f.sort !== "recommended";
}

/** Applies chips (AND), availability and sort inside each category. Empty categories stay in the list. */
export function applyFilters<C extends Category & { items: MenuItem[] }>(
  categories: C[],
  f: FilterState,
): Array<C & { visibleItems: MenuItem[] }> {
  return categories.map((c) => {
    let items = c.items.filter(
      (i) => (!f.availableOnly || i.isAvailable) && f.active.every((k) => matchesFilter(i, k)),
    );
    if (f.sort !== "recommended") {
      const dir = f.sort === "price-asc" ? 1 : -1;
      items = [...items].sort((a, b) => (basePrice(a) - basePrice(b)) * dir);
    }
    return { ...c, visibleItems: items };
  });
}

/** Items for the featured carousel: chef picks, featured and offers (available first). */
export function featuredItems(categories: Array<{ items: MenuItem[] }>, max = 10): MenuItem[] {
  const all = categories.flatMap((c) => c.items);
  const picks = all.filter((i) => i.isFeatured || i.tags.includes("chef_pick") || isOnOffer(i));
  return picks.sort((a, b) => Number(b.isAvailable) - Number(a.isAvailable)).slice(0, max);
}

/** Similar items: same category first, then shared tags; excludes the item itself. */
export function similarItems(
  item: MenuItem,
  categories: Array<{ items: MenuItem[] }>,
  max = 8,
): MenuItem[] {
  const all = categories.flatMap((c) => c.items).filter((i) => i.id !== item.id);
  const score = (i: MenuItem) =>
    (i.categoryId === item.categoryId ? 10 : 0) +
    i.tags.filter((t) => item.tags.includes(t)).length * 2 +
    (i.isAvailable ? 1 : 0);
  return all
    .map((i) => ({ i, s: score(i) }))
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((x) => x.i);
}
