import {
  Apple,
  Beef,
  Beer,
  Cake,
  Candy,
  ChefHat,
  Cherry,
  Citrus,
  Coffee,
  CookingPot,
  Cookie,
  Croissant,
  CupSoda,
  Dessert,
  Donut,
  Drumstick,
  Egg,
  Fish,
  Flame,
  GlassWater,
  Grape,
  Ham,
  Hamburger,
  IceCreamCone,
  Leaf,
  Martini,
  Milk,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Soup,
  Sparkles,
  Sprout,
  TrendingUp,
  Utensils,
  UtensilsCrossed,
  WheatOff,
  Wine,
  type LucideIcon,
} from "lucide-react";
import type { SVGProps } from "react";
import type { ItemTag } from "@/lib/data/types";

/** Curated, statically imported category icons (lucide kebab-case names + common aliases). */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  apple: Apple,
  beef: Beef,
  steak: Beef,
  grill: Beef,
  beer: Beer,
  cake: Cake,
  "cake-slice": Cake,
  candy: Candy,
  "chef-hat": ChefHat,
  cherry: Cherry,
  citrus: Citrus,
  juice: Citrus,
  coffee: Coffee,
  "cup-hot": Coffee,
  "cooking-pot": CookingPot,
  cookie: Cookie,
  croissant: Croissant,
  breakfast: Croissant,
  "cup-soda": CupSoda,
  soda: CupSoda,
  drinks: CupSoda,
  dessert: Dessert,
  donut: Donut,
  drumstick: Drumstick,
  chicken: Drumstick,
  egg: Egg,
  "egg-fried": Egg,
  fish: Fish,
  flame: Flame,
  "glass-water": GlassWater,
  grape: Grape,
  ham: Ham,
  hamburger: Hamburger,
  burger: Hamburger,
  "ice-cream": IceCreamCone,
  "ice-cream-cone": IceCreamCone,
  "ice-cream-bowl": IceCreamCone,
  leaf: Leaf,
  martini: Martini,
  cocktail: Martini,
  milk: Milk,
  pizza: Pizza,
  popcorn: Popcorn,
  salad: Salad,
  sandwich: Sandwich,
  soup: Soup,
  sparkles: Sparkles,
  sprout: Sprout,
  utensils: Utensils,
  "utensils-crossed": UtensilsCrossed,
  wine: Wine,
};

export function categoryIcon(name: string | null | undefined): LucideIcon {
  if (!name) return UtensilsCrossed;
  return CATEGORY_ICONS[name.toLowerCase()] ?? UtensilsCrossed;
}

export const TAG_ICONS: Record<ItemTag, LucideIcon> = {
  new: Sparkles,
  popular: TrendingUp,
  spicy: Flame,
  vegetarian: Leaf,
  vegan: Sprout,
  gluten_free: WheatOff,
  chef_pick: ChefHat,
};

/* Simple social glyphs (lucide v1 has no brand icons). */
type P = SVGProps<SVGSVGElement>;

export function InstagramGlyph(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookGlyph(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4A21 21 0 0 0 14.4 4C12 4 10.5 5.5 10.5 8.1v2.4H8v3h2.5V21h3Z" />
    </svg>
  );
}

export function TiktokGlyph(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M16.6 3c.4 2.2 1.8 3.7 4 3.9v3a7.3 7.3 0 0 1-4-1.2v6.1A5.8 5.8 0 1 1 10.8 9v3.1a2.8 2.8 0 1 0 2.8 2.8V3h3Z" />
    </svg>
  );
}

export function WhatsappGlyph(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden {...props}>
      <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4l-4.5 1.1Z" />
      <path
        d="M9 8.6c.2-.5.5-.6.8-.6h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .5-.1.6l-.5.6c.6 1.2 1.5 2.1 2.7 2.7l.6-.5c.2-.2.4-.2.6-.1l1.5.6c.3.1.4.3.4.5v.5c0 .3-.1.6-.6.8-.6.3-1.6.4-3-.3a8.4 8.4 0 0 1-3.7-3.7c-.7-1.4-.6-2.4-.3-3Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
