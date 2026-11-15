/**
 * Text normalization for menu search (Arabic + Latin).
 *  - أ إ آ ٱ -> ا,  ة -> ه,  ى -> ي,  ؤ -> و,  ئ -> ي
 *  - strips tashkeel (harakat, shadda, sukun, superscript alef...) and tatweel (ـ)
 *  - Latin: case-insensitive and accent-insensitive (é -> e)
 *  - Arabic-Indic digits -> Latin digits
 */

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/;
const LATIN_MARKS = /[̀-ͯ]/g;

const CHAR_MAP: Record<string, string> = {
  "أ": "ا",
  "إ": "ا",
  "آ": "ا",
  "ٱ": "ا",
  "ة": "ه",
  "ى": "ي",
  "ؤ": "و",
  "ئ": "ي",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

function normalizeChar(ch: string): string {
  if (TASHKEEL.test(ch)) return "";
  const mapped = CHAR_MAP[ch];
  if (mapped) return mapped;
  // Decompose accented Latin letters and drop the marks; lowercase everything.
  return ch.normalize("NFD").replace(LATIN_MARKS, "").toLowerCase();
}

/** Normalized form of a string (for comparing). Whitespace is collapsed. */
export function normalizeText(input: string): string {
  let out = "";
  for (const ch of input) out += normalizeChar(ch);
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Normalizes `input` and keeps, for every character of the result, the index range of the
 * original character it came from. Used to highlight matches in the original text.
 */
export function normalizeWithMap(input: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  let index = 0;
  let lastWasSpace = false;
  for (const ch of input) {
    const n = normalizeChar(ch);
    for (const c of n) {
      const isSpace = /\s/.test(c);
      if (isSpace && lastWasSpace) continue;
      text += isSpace ? " " : c;
      map.push(index);
      lastWasSpace = isSpace;
    }
    index += ch.length;
  }
  return { text, map };
}

/**
 * Finds every occurrence of the (already normalized) query tokens inside `original` and returns
 * ranges in the ORIGINAL string, merged and sorted. Empty array when nothing matches.
 */
export function findMatchRanges(original: string, tokens: string[]): Array<[number, number]> {
  if (!original || tokens.length === 0) return [];
  const { text, map } = normalizeWithMap(original);
  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    if (!token) continue;
    let from = 0;
    while (from <= text.length - token.length) {
      const at = text.indexOf(token, from);
      if (at === -1) break;
      const start = map[at];
      const lastIdx = map[at + token.length - 1];
      // End = start of the next original char after the last matched one (include combining marks).
      let end = lastIdx + 1;
      const nextMapped = map[at + token.length];
      if (nextMapped !== undefined) end = Math.max(end, nextMapped);
      else end = original.length;
      // Trim trailing whitespace from the highlighted range.
      while (end > start && /\s/.test(original[end - 1])) end--;
      ranges.push([start, end]);
      from = at + token.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

/** Splits a normalized query into search tokens. */
export function queryTokens(query: string): string[] {
  return normalizeText(query)
    .split(" ")
    .filter((t) => t.length > 0);
}
