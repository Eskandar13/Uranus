import type { Category, MenuItem } from "@/lib/data/types";
import { normalizeText, queryTokens } from "./normalize";

export interface SearchDoc {
  item: MenuItem;
  category: Category;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  categoryText: string;
}

export interface SearchResult {
  item: MenuItem;
  category: Category;
  score: number;
}

/** Pre-normalizes every item once (both languages) so typing stays instant. */
export function buildSearchIndex(categories: Array<Category & { items: MenuItem[] }>): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const category of categories) {
    const categoryText = normalizeText(`${category.name.ar} ${category.name.en}`);
    for (const item of category.items) {
      docs.push({
        item,
        category,
        nameAr: normalizeText(item.name.ar),
        nameEn: normalizeText(item.name.en),
        descAr: normalizeText(item.description.ar),
        descEn: normalizeText(item.description.en),
        categoryText,
      });
    }
  }
  return docs;
}

function fieldScore(field: string, token: string, weight: number): number {
  if (!field) return 0;
  const at = field.indexOf(token);
  if (at === -1) return 0;
  if (at === 0) return weight * 3; // starts with
  if (field[at - 1] === " ") return weight * 2; // word starts with
  return weight; // somewhere inside
}

/**
 * Every query token must match at least one field (names, descriptions, category, both languages).
 * Results are ranked: name prefix > word prefix > inside name > description > category.
 */
export function searchMenu(index: SearchDoc[], query: string, limit = 40): SearchResult[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];
  const results: SearchResult[] = [];
  for (const doc of index) {
    let total = 0;
    let ok = true;
    for (const token of tokens) {
      const s = Math.max(
        fieldScore(doc.nameAr, token, 10),
        fieldScore(doc.nameEn, token, 10),
        fieldScore(doc.descAr, token, 3),
        fieldScore(doc.descEn, token, 3),
        fieldScore(doc.categoryText, token, 2),
      );
      if (s === 0) {
        ok = false;
        break;
      }
      total += s;
    }
    if (!ok) continue;
    if (doc.item.isAvailable) total += 1;
    results.push({ item: doc.item, category: doc.category, score: total });
  }
  results.sort((a, b) => b.score - a.score || a.item.sortOrder - b.item.sortOrder);
  return results.slice(0, limit);
}
