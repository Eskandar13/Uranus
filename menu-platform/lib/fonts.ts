import { Cairo, El_Messiri, IBM_Plex_Sans_Arabic, Readex_Pro, Tajawal } from "next/font/google";
import type { FontId } from "@/lib/data/types";

/**
 * All fonts are self-hosted by next/font and exposed as CSS variables on <html>.
 * A font file is only downloaded by the browser when some element actually uses it.
 * The menu applies the restaurant's choice with: style={{ fontFamily: fontVar(theme.font) }}
 */
const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo", display: "swap" });
const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});
const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});
const readex = Readex_Pro({ subsets: ["arabic", "latin"], variable: "--font-readex", display: "swap" });
const messiri = El_Messiri({ subsets: ["arabic", "latin"], variable: "--font-messiri", display: "swap" });

export const fontVariables = [cairo, tajawal, plex, readex, messiri].map((f) => f.variable).join(" ");

const FONT_VARS: Record<FontId, string> = {
  cairo: "var(--font-cairo)",
  tajawal: "var(--font-tajawal)",
  "ibm-plex": "var(--font-plex)",
  readex: "var(--font-readex)",
  "el-messiri": "var(--font-messiri)",
};

export const FONT_LABELS: Record<FontId, string> = {
  cairo: "Cairo",
  tajawal: "Tajawal",
  "ibm-plex": "IBM Plex Sans Arabic",
  readex: "Readex Pro",
  "el-messiri": "El Messiri",
};

/** CSS font-family value for a theme font, with system fallbacks. */
export function fontVar(id: FontId): string {
  return `${FONT_VARS[id] ?? FONT_VARS.cairo}, system-ui, sans-serif`;
}
