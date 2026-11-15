import "server-only";
import type { Restaurant } from "@/lib/data/types";
import { fontVar } from "@/lib/fonts";

/** Brand info the item editor preview needs (computed on the server: fonts live in lib/fonts.ts). */
export function editorBrand(r: Restaurant) {
  return {
    primary: r.theme.primary,
    accent: r.theme.accent,
    fontFamily: fontVar(r.theme.font),
    radius: r.theme.radius,
  };
}
