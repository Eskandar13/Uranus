/**
 * Brand color helpers: readable text on brand backgrounds and brand-tinted text that keeps
 * WCAG contrast in light and dark mode.
 */

type RGB = [number, number, number];

export function parseHex(hex: string | null | undefined): RGB | null {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as RGB;
}

export function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(rgb: RGB): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const WHITE: RGB = [255, 255, 255];
const INK: RGB = [17, 17, 17];

/** Black-ish or white text, whichever reads better on `hex`. */
export function readableOn(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return "#ffffff";
  return contrast(rgb, WHITE) >= contrast(rgb, INK) ? "#ffffff" : "#111111";
}

/** Moves `hex` toward black (or white) until it reaches `ratio` contrast against `bg`. */
export function ensureContrast(hex: string, bgHex: string, ratio = 4.5): string {
  const rgb = parseHex(hex);
  const bg = parseHex(bgHex);
  if (!rgb || !bg) return hex;
  if (contrast(rgb, bg) >= ratio) return toHex(rgb);
  const target: RGB = luminance(bg) > 0.5 ? [0, 0, 0] : WHITE;
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mix(rgb, target, t);
    if (contrast(c, bg) >= ratio) return toHex(c);
  }
  return toHex(target);
}

/** CSS custom properties for the menu root, from the restaurant theme. */
export function brandVars(primary: string, accent: string): Record<string, string> {
  const brand = parseHex(primary) ? primary : "#B45309";
  const acc = parseHex(accent) ? accent : brand;
  return {
    "--brand": brand,
    "--brand-contrast": readableOn(brand),
    "--brand-accent": acc,
    "--brand-accent-contrast": readableOn(acc),
    // Brand-colored text that stays readable on light and on dark surfaces.
    "--brand-ink-light": ensureContrast(brand, "#ffffff", 4.5),
    "--brand-ink-dark": ensureContrast(brand, "#141414", 4.5),
    "--accent-ink-light": ensureContrast(acc, "#ffffff", 4.5),
    "--accent-ink-dark": ensureContrast(acc, "#141414", 4.5),
  };
}
