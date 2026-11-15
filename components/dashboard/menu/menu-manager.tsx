"use client";

import { createElement, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ChevronLeft,
  Eye,
  EyeOff,
  FolderPlus,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  SearchX,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, pick } from "@/lib/i18n/config";
import type { Category, MenuItem } from "@/lib/data/types";
import {
  deleteCategoryAction,
  deleteItemAction,
  duplicateItemAction,
  patchItemAction,
  reorderCategoriesAction,
  reorderItemsAction,
  setCategoryVisibilityAction,
} from "@/lib/dashboard/actions";
import type { ItemQuickPatch } from "@/lib/dashboard/schemas";
import { categoryIcon } from "@/components/menu/icons";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "../confirm-dialog";
import { callAction, useFeedback, useT } from "../hooks";
import { EmptyState, PageHeader, Thumb, inputClass } from "../ui";
import { CategoryDialog } from "./category-dialog";
import { ItemRow, type ItemRowActions } from "./item-row";
import { DragHandle, SortableList } from "./sortable-list";

type Confirm =
  | { kind: "item"; item: MenuItem }
  | { kind: "category"; category: Category; count: number }
  | null;

/**
 * The menu manager: categories (drag to reorder) and the items of the selected category (drag to
 * reorder, inline sold-out / featured / price / duplicate / delete). Optimistic updates; the
 * server re-renders the page after every action and the local state re-syncs from props.
 * Desktop: two columns. Phone: the category list, then the items of the tapped category.
 */
export function MenuManager({
  restaurantId,
  currency,
  categories: initialCategories,
  items: initialItems,
  initialCategoryId,
}: {
  restaurantId: string;
  currency: string;
  categories: Category[];
  items: MenuItem[];
  initialCategoryId: string | null;
}) {
  const t = useT();
  const { lang } = useI18n();
  const feedback = useFeedback();
  const [, startTransition] = useTransition();

  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [synced, setSynced] = useState({ c: initialCategories, i: initialItems });
  if (synced.c !== initialCategories || synced.i !== initialItems) {
    setSynced({ c: initialCategories, i: initialItems });
    setCategories(initialCategories);
    setItems(initialItems);
  }

  const [selectedId, setSelectedId] = useState<string | null>(
    initialCategoryId && initialCategories.some((c) => c.id === initialCategoryId) ? initialCategoryId : (initialCategories[0]?.id ?? null),
  );
  const [mobileView, setMobileView] = useState<"categories" | "items">(initialCategoryId ? "items" : "categories");
  const [query, setQuery] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ open: boolean; category: Category | null; key: number }>({ open: false, category: null, key: 0 });
  const [confirm, setConfirm] = useState<Confirm>(null);

  const selected = categories.find((c) => c.id === selectedId) ?? categories[0] ?? null;
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.categoryId, (m.get(i.categoryId) ?? 0) + 1);
    return m;
  }, [items]);
  const selectedItems = useMemo(
    () => (selected ? items.filter((i) => i.categoryId === selected.id).sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [items, selected],
  );
  const q = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      q
        ? items.filter((i) =>
            `${i.name.ar} ${i.name.en} ${i.description.ar} ${i.description.en}`.toLowerCase().includes(q),
          )
        : [],
    [items, q],
  );
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const markBusy = (id: string, on: boolean) =>
    setBusyIds((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  /* ---------------- item actions ---------------- */

  const patchItem: ItemRowActions["onPatch"] = async (item, patch: ItemQuickPatch) => {
    const before = items;
    const optimistic: MenuItem = {
      ...item,
      ...(patch.isAvailable !== undefined && { isAvailable: patch.isAvailable }),
      ...(patch.isFeatured !== undefined && { isFeatured: patch.isFeatured }),
      ...(patch.price !== undefined && { price: patch.price }),
      ...(patch.oldPrice !== undefined && { oldPrice: patch.oldPrice }),
      ...(patch.optionPrices && {
        options: item.options.map((o) => ({ ...o, price: patch.optionPrices!.find((p) => p.id === o.id)?.price ?? o.price })),
      }),
    };
    setItems((list) => list.map((i) => (i.id === item.id ? optimistic : i)));
    markBusy(item.id, true);
    const res = await callAction(() => patchItemAction(lang, restaurantId, item.id, patch));
    markBusy(item.id, false);
    const name = pick(item.name, lang);
    const success =
      patch.price !== undefined
        ? t.item.priceSaved
        : patch.isFeatured !== undefined
          ? fmt(patch.isFeatured ? t.item.featuredOn : t.item.featuredOff, { name })
          : patch.isAvailable !== undefined
            ? fmt(patch.isAvailable ? t.overview.markedAvailable : t.overview.markedSoldOut, { name })
            : undefined;
    if (!feedback(res, success)) {
      setItems(before);
      return false;
    }
    if (res.ok) setItems((list) => list.map((i) => (i.id === item.id ? res.data : i)));
    return true;
  };

  const duplicateItem = (item: MenuItem) => {
    startTransition(async () => {
      markBusy(item.id, true);
      const res = await callAction(() => duplicateItemAction(lang, restaurantId, item.id));
      markBusy(item.id, false);
      if (feedback(res, t.item.duplicated) && res.ok) {
        setItems((list) => {
          const shifted = list.map((i) =>
            i.categoryId === item.categoryId && i.sortOrder > item.sortOrder ? { ...i, sortOrder: i.sortOrder + 1 } : i,
          );
          return [...shifted, res.data];
        });
      }
    });
  };

  const deleteItem = (item: MenuItem) => {
    const before = items;
    setItems((list) => list.filter((i) => i.id !== item.id));
    startTransition(async () => {
      const res = await callAction(() => deleteItemAction(lang, restaurantId, item.id));
      if (!feedback(res, t.item.deleted)) setItems(before);
    });
  };

  const reorderItems = (orderedIds: string[]) => {
    if (!selected) return;
    const before = items;
    const pos = new Map(orderedIds.map((id, idx) => [id, idx]));
    setItems((list) => list.map((i) => (pos.has(i.id) ? { ...i, sortOrder: pos.get(i.id)! } : i)));
    startTransition(async () => {
      const res = await callAction(() => reorderItemsAction(lang, restaurantId, selected.id, orderedIds));
      if (!feedback(res, t.menuPage.orderSaved)) setItems(before);
    });
  };

  /* ---------------- category actions ---------------- */

  const reorderCategories = (orderedIds: string[]) => {
    const before = categories;
    const byId = new Map(categories.map((c) => [c.id, c]));
    setCategories(orderedIds.map((id, idx) => ({ ...byId.get(id)!, sortOrder: idx })));
    startTransition(async () => {
      const res = await callAction(() => reorderCategoriesAction(lang, restaurantId, orderedIds));
      if (!feedback(res, t.menuPage.orderSaved)) setCategories(before);
    });
  };

  const toggleVisibility = (c: Category) => {
    const before = categories;
    const next = !c.isVisible;
    setCategories((list) => list.map((x) => (x.id === c.id ? { ...x, isVisible: next } : x)));
    startTransition(async () => {
      const res = await callAction(() => setCategoryVisibilityAction(lang, restaurantId, c.id, next));
      if (!feedback(res, fmt(next ? t.category.nowVisible : t.category.nowHidden, { name: pick(c.name, lang) }))) {
        setCategories(before);
      }
    });
  };

  const deleteCategory = (c: Category) => {
    const beforeC = categories;
    const beforeI = items;
    setCategories((list) => list.filter((x) => x.id !== c.id));
    setItems((list) => list.filter((i) => i.categoryId !== c.id));
    if (selectedId === c.id) setSelectedId(beforeC.find((x) => x.id !== c.id)?.id ?? null);
    setMobileView("categories");
    startTransition(async () => {
      const res = await callAction(() => deleteCategoryAction(lang, restaurantId, c.id));
      if (!feedback(res, t.category.deleted)) {
        setCategories(beforeC);
        setItems(beforeI);
      }
    });
  };

  const openCategory = (c: Category | null) => setDialog((d) => ({ open: true, category: c, key: d.key + 1 }));

  const selectCategory = (id: string) => {
    setSelectedId(id);
    setMobileView("items");
    setQuery("");
  };

  const itemActions: ItemRowActions = {
    onPatch: patchItem,
    onDuplicate: duplicateItem,
    onDelete: (item) => setConfirm({ kind: "item", item }),
  };

  const newItemHref = `/${lang}/dashboard/items/new${selected ? `?category=${selected.id}` : ""}`;

  /* ---------------- render ---------------- */

  return (
    <div>
      <PageHeader
        title={t.menuPage.title}
        subtitle={t.menuPage.subtitle}
        actions={
          <>
            <Button type="button" variant="outline" className="h-11 rounded-xl lg:h-10" onClick={() => openCategory(null)}>
              <FolderPlus aria-hidden />
              {t.menuPage.addCategory}
            </Button>
            {categories.length > 0 && (
              <Button asChild className="h-11 rounded-xl max-lg:hidden lg:h-10">
                <Link href={newItemHref}>
                  <Plus aria-hidden />
                  {t.menuPage.addItem}
                </Link>
              </Button>
            )}
          </>
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title={t.menuPage.noCategoriesTitle}
          body={t.menuPage.noCategoriesBody}
          className="bg-card"
          action={
            <Button className="h-11 rounded-xl px-5" onClick={() => openCategory(null)}>
              <Plus aria-hidden />
              {t.menuPage.addCategory}
            </Button>
          }
        />
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.menuPage.search}
              aria-label={t.menuPage.search}
              className={cn(inputClass, "bg-card ps-10 pe-11")}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute end-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label={t.common.clearSearch}
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>

          {q ? (
            <section aria-live="polite">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{fmt(t.menuPage.searchResults, { q: query })}</h2>
              {results.length === 0 ? (
                <EmptyState icon={SearchX} title={fmt(t.menuPage.noResults, { q: query })} className="bg-card" />
              ) : (
                <ul className="flex flex-col gap-2">
                  {results.map((item) => (
                    <li key={item.id}>
                      <ItemRow
                        item={item}
                        currency={currency}
                        categoryName={catById.get(item.categoryId)?.name}
                        actions={itemActions}
                        busy={busyIds.has(item.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-5 xl:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)] xl:gap-6">
              {/* Categories */}
              <section aria-labelledby="cats-title" className={cn("min-w-0", mobileView === "items" && "max-lg:hidden")}>
                <h2 id="cats-title" className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
                  {t.menuPage.categories}
                </h2>
                <SortableList
                  items={categories}
                  getName={(c) => pick(c.name, lang)}
                  onReorder={reorderCategories}
                  renderItem={(c, handle) => {
                    const isSel = selected?.id === c.id;
                    const count = counts.get(c.id) ?? 0;
                    const name = pick(c.name, lang);
                    return (
                      <div
                        className={cn(
                          "flex items-center gap-1 rounded-2xl border bg-card p-1.5 pe-1 shadow-xs transition-colors",
                          isSel && "lg:border-primary/40 lg:bg-primary/[0.04] lg:ring-1 lg:ring-primary/30",
                          !c.isVisible && "bg-muted/50",
                        )}
                      >
                        <DragHandle handle={handle} />
                        <button
                          type="button"
                          onClick={() => selectCategory(c.id)}
                          aria-current={isSel ? "true" : undefined}
                          aria-label={fmt(t.menuPage.showItems, { name })}
                          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-1 text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {c.imageUrl ? (
                            <Thumb src={c.imageUrl} blur={c.imageBlur} className={cn("size-10", !c.isVisible && "opacity-50")} sizes="40px" />
                          ) : (
                            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground", !c.isVisible && "opacity-50")}>
                              {createElement(categoryIcon(c.icon), { className: "size-5", "aria-hidden": true })}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-sm font-semibold", !c.isVisible && "text-muted-foreground")}>{name}</span>
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {count === 1 ? t.menuPage.itemsCountOne : fmt(t.menuPage.itemsCount, { n: count })}
                              {!c.isVisible && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 font-medium">
                                  <EyeOff className="size-3" aria-hidden />
                                  {t.menuPage.hidden}
                                </span>
                              )}
                            </span>
                          </span>
                          <ChevronLeft className="size-4 shrink-0 text-muted-foreground lg:hidden ltr:rotate-180" aria-hidden />
                        </button>
                        <CategoryMenu
                          category={c}
                          onEdit={() => openCategory(c)}
                          onToggle={() => toggleVisibility(c)}
                          onDelete={() => setConfirm({ kind: "category", category: c, count })}
                        />
                      </div>
                    );
                  }}
                />
                <Button type="button" variant="ghost" className="mt-2 h-11 w-full rounded-xl border border-dashed" onClick={() => openCategory(null)}>
                  <Plus aria-hidden />
                  {t.menuPage.addCategory}
                </Button>
              </section>

              {/* Items of the selected category */}
              <section aria-labelledby="items-title" className={cn("min-w-0", mobileView === "categories" && "max-lg:hidden")}>
                {selected && (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={selected.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 rounded-xl lg:hidden"
                          onClick={() => setMobileView("categories")}
                          aria-label={t.menuPage.allCategories}
                        >
                          <ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden />
                        </Button>
                        <div className="min-w-0 flex-1">
                          <h2 id="items-title" className="truncate text-lg font-bold">
                            {pick(selected.name, lang)}
                          </h2>
                          <p className="text-xs text-muted-foreground">
                            {selectedItems.length === 1 ? t.menuPage.itemsCountOne : fmt(t.menuPage.itemsCount, { n: selectedItems.length })}
                          </p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="size-11 rounded-xl" onClick={() => openCategory(selected)} aria-label={t.category.edit}>
                          <Pencil aria-hidden />
                        </Button>
                        <Button asChild className="h-11 rounded-xl lg:h-10">
                          <Link href={newItemHref}>
                            <Plus aria-hidden />
                            <span className="max-sm:sr-only">{t.menuPage.addItem}</span>
                          </Link>
                        </Button>
                      </div>
                      {selectedItems.length === 0 ? (
                        <EmptyState
                          icon={UtensilsCrossed}
                          title={t.menuPage.noItemsTitle}
                          body={t.menuPage.noItemsBody}
                          className="bg-card"
                          action={
                            <Button asChild className="h-11 rounded-xl px-5">
                              <Link href={newItemHref}>
                                <Plus aria-hidden />
                                {t.menuPage.addItem}
                              </Link>
                            </Button>
                          }
                        />
                      ) : (
                        <SortableList
                          items={selectedItems}
                          getName={(i) => pick(i.name, lang)}
                          onReorder={reorderItems}
                          renderItem={(item, handle) => (
                            <ItemRow item={item} currency={currency} handle={handle} actions={itemActions} busy={busyIds.has(item.id)} />
                          )}
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}
              </section>
            </div>
          )}
        </>
      )}

      <CategoryDialog
        key={dialog.key}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        restaurantId={restaurantId}
        category={dialog.category}
        onSaved={(saved, created) => {
          setCategories((list) => (created ? [...list, saved] : list.map((c) => (c.id === saved.id ? saved : c))));
          if (created) {
            setSelectedId(saved.id);
            setMobileView("items");
          }
        }}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.kind === "item"
            ? fmt(t.item.deleteTitle, { name: pick(confirm.item.name, lang) })
            : confirm?.kind === "category"
              ? fmt(t.category.deleteTitle, { name: pick(confirm.category.name, lang) })
              : ""
        }
        body={
          confirm?.kind === "item"
            ? t.item.deleteBody
            : confirm?.kind === "category"
              ? confirm.count > 0
                ? fmt(t.category.deleteBody, { n: confirm.count })
                : t.category.deleteBodyEmpty
              : ""
        }
        confirmLabel={t.common.delete}
        onConfirm={() => {
          if (confirm?.kind === "item") deleteItem(confirm.item);
          if (confirm?.kind === "category") deleteCategory(confirm.category);
          setConfirm(null);
        }}
      />
    </div>
  );
}

function CategoryMenu({
  category,
  onEdit,
  onToggle,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const { lang } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-xl" aria-label={`${t.common.more}: ${pick(category.name, lang)}`}>
          <MoreVertical aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem className="min-h-11" onSelect={onEdit}>
          <Pencil aria-hidden />
          {t.category.edit}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={onToggle}>
          {category.isVisible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          {category.isVisible ? t.category.hide : t.category.show}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="min-h-11" onSelect={onDelete}>
          <Trash2 aria-hidden />
          {t.category.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
